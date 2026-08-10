import os
import logging
import uuid
import secrets
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta
from io import BytesIO

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List

import bcrypt
import jwt
import httpx

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
APP_URL = os.environ.get('APP_URL', 'http://localhost:3000')

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get('EMERGENT_EMAIL_KEY')
EMAIL_FROM_NAME = os.environ.get('EMAIL_FROM_NAME', 'SFR')

SFR_RED = colors.HexColor('#E2001A')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, remember: bool = False) -> str:
    days = 30 if remember else 1
    payload = {
        "sub": user_id,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(days=days),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "login": u["login"],
        "email": u["email"],
        "name": u["name"],
    }


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non authentifié")
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expirée")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user


async def send_email(to: str, subject: str, html: str):
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY missing, skipping email send")
        return
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        logger.info(f"Email sent to {to}")
    except Exception as e:
        logger.error(f"Email send failed: {e}")


def luhn_valid(number: str) -> bool:
    digits = [int(d) for d in re.sub(r"\D", "", number)]
    if len(digits) < 13:
        return False
    checksum = 0
    parity = len(digits) % 2
    for i, d in enumerate(digits):
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def brand_email(title: str, body_html: str) -> str:
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;font-family:Arial,sans-serif;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;">
          <tr><td style="background:#E2001A;padding:20px 32px;">
            <span style="color:#ffffff;font-size:24px;font-weight:bold;letter-spacing:1px;">SFR</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="color:#111827;font-size:20px;margin:0 0 16px;">{title}</h1>
            {body_html}
          </td></tr>
          <tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">Cet email vous a été envoyé par votre Espace Client SFR. Ne communiquez jamais vos identifiants.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    """


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    identifier: str
    password: str
    remember: bool = False


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotIdentifierRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class CardPaymentRequest(BaseModel):
    invoice_id: str
    card_number: str
    card_holder: str
    expiry: str  # MM/YY
    cvv: str


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@api_router.post("/auth/login")
async def login(payload: LoginRequest):
    ident = payload.identifier.strip().lower()
    user = await db.users.find_one({"$or": [{"login": ident}, {"email": ident}]}, {"_id": 0})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Identifiant ou mot de passe incorrect")
    token = create_access_token(user["id"], payload.remember)
    return {"token": token, "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api_router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_resets.insert_one({
            "id": str(uuid.uuid4()),
            "token": token,
            "user_id": user["id"],
            "used": False,
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=30),
            "created_at": datetime.now(timezone.utc),
        })
        link = f"{APP_URL}/reset-password?token={token}"
        html = brand_email(
            "Réinitialisation de votre mot de passe",
            f"""<p style="color:#4b5563;font-size:14px;line-height:22px;">Bonjour {user['name']},</p>
            <p style="color:#4b5563;font-size:14px;line-height:22px;">Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable 30 minutes.</p>
            <p style="margin:24px 0;"><a href="{link}" style="background:#E2001A;color:#ffffff;text-decoration:none;padding:12px 28px;font-weight:bold;display:inline-block;">Réinitialiser mon mot de passe</a></p>
            <p style="color:#9ca3af;font-size:12px;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>""",
        )
        await send_email(email, "Réinitialisation de votre mot de passe SFR", html)
    return {"message": "Si un compte est associé à cet email, un lien de réinitialisation a été envoyé."}


@api_router.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    rec = await db.password_resets.find_one({"token": payload.token}, {"_id": 0})
    if not rec or rec["used"]:
        raise HTTPException(status_code=400, detail="Lien invalide ou déjà utilisé")
    expires = rec["expires_at"]
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Lien expiré, veuillez refaire une demande")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 8 caractères")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_password(payload.password)}})
    await db.password_resets.update_one({"token": payload.token}, {"$set": {"used": True}})
    return {"message": "Votre mot de passe a été réinitialisé avec succès."}


@api_router.post("/auth/forgot-identifier")
async def forgot_identifier(payload: ForgotIdentifierRequest):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        html = brand_email(
            "Rappel de votre identifiant",
            f"""<p style="color:#4b5563;font-size:14px;line-height:22px;">Bonjour {user['name']},</p>
            <p style="color:#4b5563;font-size:14px;line-height:22px;">Vous avez demandé un rappel de votre identifiant de connexion. Le voici :</p>
            <p style="margin:24px 0;font-size:20px;font-weight:bold;color:#111827;background:#f3f4f6;padding:16px;text-align:center;letter-spacing:1px;">{user['login']}</p>
            <p style="color:#9ca3af;font-size:12px;">Vous pouvez maintenant vous connecter à votre Espace Client SFR.</p>""",
        )
        await send_email(email, "Votre identifiant de connexion SFR", html)
    return {"message": "Si un compte est associé à cet email, votre identifiant vous a été envoyé."}


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------
def public_invoice(inv: dict) -> dict:
    return {
        "id": inv["id"],
        "number": inv["number"],
        "label": inv["label"],
        "period": inv["period"],
        "amount": inv["amount"],
        "due_date": inv["due_date"],
        "status": inv["status"],
        "iban_masked": inv["iban_masked"],
        "paid_at": inv.get("paid_at"),
        "transaction_id": inv.get("transaction_id"),
        "payment_method": inv.get("payment_method", "Prélèvement automatique par IBAN"),
        "mandate_status": inv.get("mandate_status", "active"),
        "failure_reason": inv.get("failure_reason"),
        "failure_code": inv.get("failure_code"),
        "failure_date": inv.get("failure_date"),
        "attempts": inv.get("attempts"),
        "max_attempts": inv.get("max_attempts", 3),
        "next_attempt_date": inv.get("next_attempt_date"),
        "last_transaction_ref": inv.get("last_transaction_ref"),
        "attempt_history": inv.get("attempt_history", []),
    }


@api_router.get("/invoices")
async def list_invoices(user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({"user_id": user["id"]}, {"_id": 0}).sort("due_date", -1).to_list(200)
    return [public_invoice(i) for i in invoices]


@api_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    return public_invoice(inv)


# ---------------------------------------------------------------------------
# Payments (simulation)
# ---------------------------------------------------------------------------
@api_router.post("/payments/card")
async def pay_card(payload: CardPaymentRequest, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": payload.invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    if inv["status"] == "paid":
        raise HTTPException(status_code=400, detail="Cette facture est déjà réglée")

    card_number = re.sub(r"\s", "", payload.card_number)
    if not luhn_valid(card_number):
        raise HTTPException(status_code=422, detail="Numéro de carte invalide")
    if not re.match(r"^(0[1-9]|1[0-2])\/\d{2}$", payload.expiry):
        raise HTTPException(status_code=422, detail="Date d'expiration invalide")
    if not re.match(r"^\d{3}$", payload.cvv):
        raise HTTPException(status_code=422, detail="CVV invalide")

    # Simulation: la carte de test 4000 0000 0000 0002 échoue toujours.
    declined = card_number.endswith("0000000000000002") or card_number == "4000000000000002"
    txn_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    reference = "SFR-" + now.strftime("%Y%m%d") + "-" + secrets.token_hex(4).upper()
    status = "failed" if declined else "success"

    txn = {
        "id": txn_id,
        "reference": reference,
        "invoice_id": inv["id"],
        "invoice_number": inv["number"],
        "user_id": user["id"],
        "amount": inv["amount"],
        "card_last4": card_number[-4:],
        "card_holder": payload.card_holder,
        "iban_masked": inv["iban_masked"],
        "status": status,
        "error_message": "Votre banque a refusé la transaction. Veuillez vérifier vos informations ou utiliser une autre carte." if declined else None,
        "created_at": now.isoformat(),
    }
    await db.transactions.insert_one({**txn})

    if not declined:
        await db.invoices.update_one(
            {"id": inv["id"]},
            {"$set": {"status": "paid", "paid_at": now.isoformat(), "transaction_id": txn_id}},
        )

    txn.pop("_id", None)
    return txn


@api_router.get("/payments/{txn_id}")
async def get_payment(txn_id: str, user: dict = Depends(get_current_user)):
    txn = await db.transactions.find_one({"id": txn_id, "user_id": user["id"]}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    return txn


@api_router.get("/invoices/{invoice_id}/receipt.pdf")
async def receipt_pdf(invoice_id: str, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    if inv["status"] != "paid" or not inv.get("transaction_id"):
        raise HTTPException(status_code=400, detail="Aucun reçu disponible pour cette facture")
    txn = await db.transactions.find_one({"id": inv["transaction_id"]}, {"_id": 0})

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    # Header band
    c.setFillColor(SFR_RED)
    c.rect(0, h - 45 * mm, w, 45 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 32)
    c.drawString(20 * mm, h - 30 * mm, "SFR")
    c.setFont("Helvetica", 12)
    c.drawRightString(w - 20 * mm, h - 25 * mm, "Reçu de paiement")
    c.setFont("Helvetica", 9)
    c.drawRightString(w - 20 * mm, h - 32 * mm, "Espace Client")

    y = h - 62 * mm
    c.setFillColor(colors.HexColor('#111827'))
    c.setFont("Helvetica-Bold", 18)
    c.drawString(20 * mm, y, "Paiement confirmé")
    y -= 8 * mm
    c.setFillColor(colors.HexColor('#16A34A'))
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20 * mm, y, "Statut : PAYÉE")

    def paid_date():
        try:
            return datetime.fromisoformat(inv["paid_at"]).strftime("%d/%m/%Y à %H:%M")
        except Exception:
            return inv.get("paid_at", "")

    rows = [
        ("Client", user["name"]),
        ("Numéro de facture", inv["number"]),
        ("Libellé", inv["label"]),
        ("Période", inv["period"]),
        ("Référence transaction", txn["reference"] if txn else ""),
        ("Date de paiement", paid_date()),
        ("Moyen de paiement", f"Carte bancaire ****{txn['card_last4']}" if txn else "Carte bancaire"),
        ("IBAN de prélèvement", inv["iban_masked"]),
    ]

    y -= 14 * mm
    c.setFillColor(colors.HexColor('#374151'))
    for label, value in rows:
        c.setFont("Helvetica", 10)
        c.setFillColor(colors.HexColor('#6b7280'))
        c.drawString(20 * mm, y, label)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(colors.HexColor('#111827'))
        c.drawString(80 * mm, y, str(value))
        c.setStrokeColor(colors.HexColor('#e5e7eb'))
        c.line(20 * mm, y - 3 * mm, w - 20 * mm, y - 3 * mm)
        y -= 11 * mm

    # Amount box
    y -= 6 * mm
    c.setFillColor(colors.HexColor('#f9fafb'))
    c.rect(20 * mm, y - 18 * mm, w - 40 * mm, 22 * mm, fill=1, stroke=0)
    c.setFillColor(colors.HexColor('#6b7280'))
    c.setFont("Helvetica", 11)
    c.drawString(26 * mm, y - 6 * mm, "Montant réglé")
    c.setFillColor(SFR_RED)
    c.setFont("Helvetica-Bold", 22)
    c.drawRightString(w - 26 * mm, y - 8 * mm, f"{inv['amount']:.2f} EUR".replace(".", ","))

    c.setFillColor(colors.HexColor('#9ca3af'))
    c.setFont("Helvetica", 8)
    c.drawString(20 * mm, 15 * mm, "SFR — Ce reçu atteste du règlement de la facture mentionnée ci-dessus. Document généré automatiquement.")
    c.showPage()
    c.save()
    buf.seek(0)
    filename = f"recu-{inv['number']}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/invoices/{invoice_id}/facture.pdf")
async def facture_pdf(invoice_id: str, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Facture introuvable")

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    c.setFillColor(SFR_RED)
    c.rect(0, h - 45 * mm, w, 45 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 32)
    c.drawString(20 * mm, h - 30 * mm, "SFR")
    c.setFont("Helvetica", 12)
    c.drawRightString(w - 20 * mm, h - 25 * mm, "Facture")
    c.setFont("Helvetica", 9)
    c.drawRightString(w - 20 * mm, h - 32 * mm, f"N° {inv['number']}")

    y = h - 62 * mm
    c.setFillColor(colors.HexColor('#111827'))
    c.setFont("Helvetica-Bold", 18)
    c.drawString(20 * mm, y, inv["label"])
    y -= 8 * mm
    is_paid = inv["status"] == "paid"
    c.setFillColor(colors.HexColor('#16A34A') if is_paid else SFR_RED)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20 * mm, y, "Statut : PAYÉE" if is_paid else "Statut : IMPAYÉE")

    rows = [
        ("Client", user["name"]),
        ("Numéro de facture", inv["number"]),
        ("Période", inv["period"]),
        ("Date d'échéance", inv["due_date"]),
        ("Moyen de paiement", inv.get("payment_method", "Prélèvement automatique par IBAN")),
        ("IBAN de prélèvement", inv["iban_masked"]),
    ]
    y -= 14 * mm
    for label, value in rows:
        c.setFont("Helvetica", 10)
        c.setFillColor(colors.HexColor('#6b7280'))
        c.drawString(20 * mm, y, label)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(colors.HexColor('#111827'))
        c.drawString(80 * mm, y, str(value))
        c.setStrokeColor(colors.HexColor('#e5e7eb'))
        c.line(20 * mm, y - 3 * mm, w - 20 * mm, y - 3 * mm)
        y -= 11 * mm

    y -= 6 * mm
    c.setFillColor(colors.HexColor('#f9fafb'))
    c.rect(20 * mm, y - 18 * mm, w - 40 * mm, 22 * mm, fill=1, stroke=0)
    c.setFillColor(colors.HexColor('#6b7280'))
    c.setFont("Helvetica", 11)
    c.drawString(26 * mm, y - 6 * mm, "Montant total TTC")
    c.setFillColor(SFR_RED)
    c.setFont("Helvetica-Bold", 22)
    c.drawRightString(w - 26 * mm, y - 8 * mm, f"{inv['amount']:.2f} EUR".replace(".", ","))

    c.setFillColor(colors.HexColor('#9ca3af'))
    c.setFont("Helvetica", 8)
    c.drawString(20 * mm, 15 * mm, "SFR — Facture générée automatiquement par votre Espace Client.")
    c.showPage()
    c.save()
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="facture-{inv["number"]}.pdf"'},
    )


# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------
async def seed():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("login", unique=True)
    await db.password_resets.create_index("expires_at", expireAfterSeconds=0)

    email = os.environ.get("SEED_CLIENT_EMAIL", "dacostakanan@gmail.com").lower()
    login = os.environ.get("SEED_CLIENT_LOGIN", "dacostakanan").lower()
    password = os.environ.get("SEED_CLIENT_PASSWORD", "Sfr@2026!")

    user = await db.users.find_one({"email": email})
    if user is None:
        user_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": user_id,
            "login": login,
            "email": email,
            "name": "Kanan Da Costa",
            "password_hash": hash_password(password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    else:
        user_id = user["id"]
        # keep password in sync with env for the seed account
        if not verify_password(password, user["password_hash"]):
            await db.users.update_one({"id": user_id}, {"$set": {"password_hash": hash_password(password)}})

    if await db.invoices.count_documents({"user_id": user_id}) == 0:
        iban = "FR76 3000 4000 0512 3456 7890 143"
        masked = "FR76 XXXX XXXX XXXX XXXX XXXX 143"
        seed_invoices = [
            {"number": "FACT-2026-0512", "label": "Forfait Mobile 5G + Box Fibre", "period": "Mai 2026", "amount": 64.99, "due_date": "2026-06-05", "status": "unpaid",
             "payment_method": "Prélèvement automatique par IBAN", "mandate_status": "active",
             "failure_reason": "Fonds insuffisants sur le compte bancaire associé", "failure_code": "ERR_PAY_301",
             "failure_date": "2026-06-06T09:12:00", "attempts": 2, "max_attempts": 3, "next_attempt_date": "2026-06-23",
             "last_transaction_ref": "TXN-1948960898",
             "attempt_history": [
                 {"date": "2026-06-06T09:12:00", "status": "failed", "reason": "Fonds insuffisants", "ref": "TXN-1948960898"},
                 {"date": "2026-06-01T06:00:00", "status": "failed", "reason": "Fonds insuffisants", "ref": "TXN-1931004552"},
             ]},
            {"number": "FACT-2026-0411", "label": "Forfait Mobile 5G + Box Fibre", "period": "Avril 2026", "amount": 64.99, "due_date": "2026-05-05", "status": "unpaid",
             "payment_method": "Prélèvement automatique par IBAN", "mandate_status": "active",
             "failure_reason": "Prélèvement rejeté par la banque", "failure_code": "ERR_PAY_205",
             "failure_date": "2026-05-06T08:40:00", "attempts": 1, "max_attempts": 3, "next_attempt_date": "2026-05-20",
             "last_transaction_ref": "TXN-1847221093",
             "attempt_history": [
                 {"date": "2026-05-06T08:40:00", "status": "failed", "reason": "Rejet banque", "ref": "TXN-1847221093"},
             ]},
            {"number": "FACT-2026-0322", "label": "Option Multi-SIM + International", "period": "Mars 2026", "amount": 12.00, "due_date": "2026-04-05", "status": "unpaid",
             "payment_method": "Prélèvement automatique par IBAN", "mandate_status": "suspended",
             "failure_reason": "Mandat SEPA expiré", "failure_code": "ERR_PAY_118",
             "failure_date": "2026-04-06T10:05:00", "attempts": 3, "max_attempts": 3, "next_attempt_date": None,
             "last_transaction_ref": "TXN-1720558471",
             "attempt_history": [
                 {"date": "2026-04-06T10:05:00", "status": "failed", "reason": "Mandat expiré", "ref": "TXN-1720558471"},
             ]},
            {"number": "FACT-2026-0210", "label": "Forfait Mobile 5G + Box Fibre", "period": "Février 2026", "amount": 64.99, "due_date": "2026-03-05", "status": "paid",
             "payment_method": "Carte bancaire", "mandate_status": "active"},
        ]
        docs = []
        for inv in seed_invoices:
            docs.append({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "iban": iban,
                "iban_masked": masked,
                "paid_at": None,
                "transaction_id": None,
                **inv,
            })
        await db.invoices.insert_many(docs)
    logger.info("Seed complete")


@api_router.get("/")
async def root():
    return {"message": "SFR Espace Client API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await seed()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
