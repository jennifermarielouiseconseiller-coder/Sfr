"""End-to-end backend tests for SFR Espace Client."""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if os.environ.get('REACT_APP_BACKEND_URL') else "https://sfr-card-reset.preview.emergentagent.com"
API = f"{BASE_URL}/api"

CREDS = {"identifier": "dacostakanan", "password": "Sfr@2026!", "remember": False}
EMAIL = "dacostakanan@gmail.com"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json=CREDS, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---- Auth
def test_login_success():
    r = requests.post(f"{API}/auth/login", json=CREDS, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert "token" in body and body["user"]["email"] == EMAIL
    assert body["user"]["login"] == "dacostakanan"


def test_login_with_email():
    r = requests.post(f"{API}/auth/login", json={"identifier": EMAIL, "password": "Sfr@2026!"}, timeout=30)
    assert r.status_code == 200


def test_login_wrong_password():
    r = requests.post(f"{API}/auth/login", json={"identifier": "dacostakanan", "password": "wrong"}, timeout=30)
    assert r.status_code == 401
    assert "Identifiant ou mot de passe incorrect" in r.json().get("detail", "")


def test_me_requires_auth():
    r = requests.get(f"{API}/auth/me", timeout=30)
    assert r.status_code == 401


def test_me_ok(auth_headers):
    r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    assert r.json()["email"] == EMAIL


# ---- Forgot flows
def test_forgot_password_returns_generic():
    r = requests.post(f"{API}/auth/forgot-password", json={"email": EMAIL}, timeout=30)
    assert r.status_code == 200
    assert "message" in r.json()


def test_forgot_password_unknown_email_still_200():
    r = requests.post(f"{API}/auth/forgot-password", json={"email": "nobody@example.com"}, timeout=30)
    assert r.status_code == 200


def test_forgot_identifier_ok():
    r = requests.post(f"{API}/auth/forgot-identifier", json={"email": EMAIL}, timeout=30)
    assert r.status_code == 200


# ---- Reset password (using Mongo to pull token)
def _get_reset_token():
    mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = mongo[os.environ.get("DB_NAME", "test_database")]
    requests.post(f"{API}/auth/forgot-password", json={"email": EMAIL}, timeout=30)
    rec = db.password_resets.find_one({"used": False}, sort=[("created_at", -1)])
    return rec["token"] if rec else None


def test_reset_password_mismatch_len():
    r = requests.post(f"{API}/auth/reset-password", json={"token": "invalid-tok", "password": "abc"}, timeout=30)
    assert r.status_code == 400


def test_reset_password_valid_token_flow():
    tok = _get_reset_token()
    if not tok:
        pytest.skip("Cannot access Mongo to fetch reset token")
    # short pwd rejected
    r = requests.post(f"{API}/auth/reset-password", json={"token": tok, "password": "short"}, timeout=30)
    assert r.status_code == 400
    # valid reset - use same password to avoid breaking test creds
    r = requests.post(f"{API}/auth/reset-password", json={"token": tok, "password": "Sfr@2026!"}, timeout=30)
    assert r.status_code == 200
    # cannot reuse
    r = requests.post(f"{API}/auth/reset-password", json={"token": tok, "password": "Sfr@2026!"}, timeout=30)
    assert r.status_code == 400


# ---- Invoices
def test_list_invoices(auth_headers):
    r = requests.get(f"{API}/invoices", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    lst = r.json()
    assert len(lst) >= 4
    unpaid = [i for i in lst if i["status"] == "unpaid"]
    paid = [i for i in lst if i["status"] == "paid"]
    assert len(unpaid) >= 1 and len(paid) >= 1
    for inv in lst:
        assert "iban_masked" in inv and "amount" in inv


def test_invoices_require_auth():
    r = requests.get(f"{API}/invoices", timeout=30)
    assert r.status_code == 401


# ---- Payments
@pytest.fixture(scope="module")
def unpaid_invoice(auth_headers):
    r = requests.get(f"{API}/invoices", headers=auth_headers, timeout=30)
    unpaid = [i for i in r.json() if i["status"] == "unpaid"]
    assert unpaid, "No unpaid invoice seeded"
    return unpaid[0]


def test_payment_luhn_invalid(auth_headers, unpaid_invoice):
    r = requests.post(f"{API}/payments/card", headers=auth_headers, json={
        "invoice_id": unpaid_invoice["id"], "card_number": "1234567890123456",
        "card_holder": "Kanan", "expiry": "12/28", "cvv": "123",
    }, timeout=30)
    assert r.status_code == 422


def test_payment_bad_expiry(auth_headers, unpaid_invoice):
    r = requests.post(f"{API}/payments/card", headers=auth_headers, json={
        "invoice_id": unpaid_invoice["id"], "card_number": "4242424242424242",
        "card_holder": "Kanan", "expiry": "13/99", "cvv": "123",
    }, timeout=30)
    assert r.status_code == 422


def test_payment_bad_cvv(auth_headers, unpaid_invoice):
    r = requests.post(f"{API}/payments/card", headers=auth_headers, json={
        "invoice_id": unpaid_invoice["id"], "card_number": "4242424242424242",
        "card_holder": "Kanan", "expiry": "12/28", "cvv": "12",
    }, timeout=30)
    assert r.status_code == 422


def test_payment_failure_card(auth_headers, unpaid_invoice):
    r = requests.post(f"{API}/payments/card", headers=auth_headers, json={
        "invoice_id": unpaid_invoice["id"], "card_number": "4000000000000002",
        "card_holder": "Kanan", "expiry": "12/28", "cvv": "123",
    }, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "failed"
    assert body["error_message"]
    # invoice should remain unpaid
    inv = requests.get(f"{API}/invoices/{unpaid_invoice['id']}", headers=auth_headers, timeout=30).json()
    assert inv["status"] == "unpaid"


def test_payment_success_and_receipt(auth_headers):
    r = requests.get(f"{API}/invoices", headers=auth_headers, timeout=30)
    unpaid = [i for i in r.json() if i["status"] == "unpaid"]
    if not unpaid:
        pytest.skip("no unpaid invoice")
    target = unpaid[-1]  # take last one to preserve others for UI tests
    r = requests.post(f"{API}/payments/card", headers=auth_headers, json={
        "invoice_id": target["id"], "card_number": "4242 4242 4242 4242",
        "card_holder": "Kanan Da Costa", "expiry": "12/28", "cvv": "123",
    }, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "success"
    assert body["reference"].startswith("SFR-")
    assert body["card_last4"] == "4242"
    txn_id = body["id"]

    # Invoice flipped
    inv = requests.get(f"{API}/invoices/{target['id']}", headers=auth_headers, timeout=30).json()
    assert inv["status"] == "paid" and inv["transaction_id"] == txn_id

    # Cannot pay again
    r2 = requests.post(f"{API}/payments/card", headers=auth_headers, json={
        "invoice_id": target["id"], "card_number": "4242424242424242",
        "card_holder": "Kanan", "expiry": "12/28", "cvv": "123",
    }, timeout=30)
    assert r2.status_code == 400

    # Receipt PDF
    r3 = requests.get(f"{API}/invoices/{target['id']}/receipt.pdf", headers=auth_headers, timeout=30)
    assert r3.status_code == 200
    assert r3.headers["content-type"].startswith("application/pdf")
    assert r3.content.startswith(b"%PDF")


def test_get_payment_by_id(auth_headers):
    # login already produced transactions from prior test
    r = requests.get(f"{API}/invoices", headers=auth_headers, timeout=30).json()
    paid = [i for i in r if i["status"] == "paid" and i.get("transaction_id")]
    if not paid:
        pytest.skip("no paid invoice")
    txn_id = paid[0]["transaction_id"]
    resp = requests.get(f"{API}/payments/{txn_id}", headers=auth_headers, timeout=30)
    assert resp.status_code == 200
    assert resp.json()["id"] == txn_id


# ---- Iteration 2: enriched invoice + facture.pdf
def test_invoice_detail_has_failure_fields(auth_headers):
    r = requests.get(f"{API}/invoices", headers=auth_headers, timeout=30)
    unpaid = [i for i in r.json() if i["status"] == "unpaid"]
    if not unpaid:
        pytest.skip("no unpaid invoice")
    inv = requests.get(f"{API}/invoices/{unpaid[0]['id']}", headers=auth_headers, timeout=30).json()
    for k in ("failure_reason", "failure_code", "failure_date", "attempts",
              "max_attempts", "mandate_status", "payment_method",
              "last_transaction_ref", "attempt_history"):
        assert k in inv, f"missing {k} in invoice detail"
    assert isinstance(inv["attempt_history"], list)
    assert inv["attempts"] >= 1 and inv["max_attempts"] == 3


def test_facture_pdf_ok(auth_headers):
    r = requests.get(f"{API}/invoices", headers=auth_headers, timeout=30)
    lst = r.json()
    if not lst:
        pytest.skip("no invoice")
    inv_id = lst[0]["id"]
    r = requests.get(f"{API}/invoices/{inv_id}/facture.pdf", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
    assert r.content.startswith(b"%PDF")


def test_facture_pdf_requires_auth():
    r = requests.get(f"{API}/invoices", headers={"Authorization": "Bearer bad"}, timeout=30)
    # need a real id: use auth
    r2 = requests.get(f"{API}/invoices/nonexistent/facture.pdf", timeout=30)
    assert r2.status_code in (401, 403)
