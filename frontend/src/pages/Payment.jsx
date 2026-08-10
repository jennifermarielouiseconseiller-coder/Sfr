import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api, formatEUR, getToken, API, formatApiError } from "@/lib/api";
import { SfrLogo } from "@/components/Layout";
import { PAYMENT } from "@/constants/testIds";
import {
  Lock, CreditCard, ShieldCheck, ArrowLeft, CheckCircle2,
  Download, AlertTriangle, RotateCcw, User,
} from "lucide-react";

function luhnValid(num) {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function formatCardNumber(v) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(v) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  if (d.length >= 3) return d.slice(0, 2) + "/" + d.slice(2);
  return d;
}

function Stepper({ step }) {
  const steps = ["Informations", "Traitement", "Confirmation"];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 flex items-center justify-center text-xs font-bold shrink-0 ${
              i <= step ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
            }`}
          >
            {i + 1}
          </div>
          <span className={`text-sm hidden sm:inline ${i <= step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            {s}
          </span>
          {i < steps.length - 1 && <div className="w-6 sm:w-8 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}

export default function Payment() {
  const { id } = useParams();
  const nav = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [phase, setPhase] = useState("form"); // form | processing | success | failure
  const [txn, setTxn] = useState(null);
  const [failMsg, setFailMsg] = useState("");

  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api
      .get(`/invoices/${id}`)
      .then((r) => {
        if (r.data.status === "paid") nav(`/factures/${id}`);
        else setInvoice(r.data);
      })
      .catch(() => nav("/verification"));
  }, [id, nav]);

  const validate = () => {
    const e = {};
    if (!luhnValid(number)) e.number = "Numéro de carte invalide";
    if (holder.trim().length < 3) e.holder = "Nom du porteur requis";
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) e.expiry = "Format MM/AA invalide";
    else {
      const [mm, yy] = expiry.split("/").map(Number);
      const exp = new Date(2000 + yy, mm - 1, 1);
      const now = new Date();
      now.setDate(1);
      now.setHours(0, 0, 0, 0);
      if (exp < now) e.expiry = "Carte expirée";
    }
    if (!/^\d{3}$/.test(cvv)) e.cvv = "CVV à 3 chiffres";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setPhase("processing");
    const started = Date.now();
    try {
      const { data } = await api.post("/payments/card", {
        invoice_id: id,
        card_number: number,
        card_holder: holder,
        expiry,
        cvv,
      });
      const wait = Math.max(0, 2400 - (Date.now() - started));
      setTimeout(() => {
        if (data.status === "success") {
          setTxn(data);
          setPhase("success");
        } else {
          setFailMsg(data.error_message || "Le paiement a échoué.");
          setPhase("failure");
        }
      }, wait);
    } catch (err) {
      const wait = Math.max(0, 2400 - (Date.now() - started));
      setTimeout(() => {
        setFailMsg(formatApiError(err.response?.data?.detail));
        setPhase("failure");
      }, wait);
    }
  };

  const downloadReceipt = async () => {
    const res = await fetch(`${API}/invoices/${id}/receipt.pdf`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recu-${invoice.number}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!invoice)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const fieldClass = (key) =>
    `w-full h-12 px-4 border bg-white focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${
      errors[key] ? "border-destructive" : "border-input focus:border-primary"
    }`;

  return (
    <div className="min-h-screen bg-background" data-testid={PAYMENT.screen}>
      <header className="bg-white border-b border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-2 sm:gap-3">
          <SfrLogo size={36} />
          <span className="font-heading font-bold tracking-tight text-sm sm:text-base">Paiement sécurisé</span>
          <span className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck size={16} className="text-green-600" />
            <span className="hidden sm:inline">Connexion chiffrée</span>
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <Stepper step={phase === "form" ? 0 : phase === "processing" ? 1 : 2} />

        <AnimatePresence mode="wait">
          {phase === "form" && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button
                data-testid={PAYMENT.cancel}
                onClick={() => nav(`/factures/${id}`)}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <ArrowLeft size={16} /> Retour à la facture
              </button>

              <div className="bg-white border border-border p-6 mb-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{invoice.label}</p>
                    <p className="font-heading font-semibold">N° {invoice.number} · {invoice.period}</p>
                  </div>
                  <p data-testid={PAYMENT.summaryAmount} className="font-heading font-extrabold text-2xl sm:text-3xl text-primary shrink-0">
                    {formatEUR(invoice.amount)}
                  </p>
                </div>
              </div>

              <form onSubmit={submit} className="bg-white border border-border p-6 sm:p-8 space-y-5">
                <h2 className="font-heading font-bold text-xl tracking-tight flex items-center gap-2">
                  <CreditCard size={20} className="text-primary" /> Carte bancaire
                </h2>

                <div>
                  <label className="block text-sm font-medium mb-2">Numéro de carte</label>
                  <input
                    data-testid={PAYMENT.cardNumber}
                    inputMode="numeric"
                    value={number}
                    onChange={(e) => setNumber(formatCardNumber(e.target.value))}
                    placeholder="1234 5678 9012 3456"
                    aria-invalid={!!errors.number}
                    className={fieldClass("number")}
                  />
                  {errors.number && (
                    <p data-testid={PAYMENT.errorField} className="text-destructive text-sm mt-1.5">{errors.number}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Nom du porteur</label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      data-testid={PAYMENT.cardHolder}
                      value={holder}
                      onChange={(e) => setHolder(e.target.value.toUpperCase())}
                      placeholder="JEAN DUPONT"
                      aria-invalid={!!errors.holder}
                      className={`${fieldClass("holder")} pl-10`}
                    />
                  </div>
                  {errors.holder && (
                    <p className="text-destructive text-sm mt-1.5">{errors.holder}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Expiration</label>
                    <input
                      data-testid={PAYMENT.expiry}
                      inputMode="numeric"
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/AA"
                      aria-invalid={!!errors.expiry}
                      className={fieldClass("expiry")}
                    />
                    {errors.expiry && <p data-testid={PAYMENT.errorField} className="text-destructive text-sm mt-1.5">{errors.expiry}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">CVV</label>
                    <input
                      data-testid={PAYMENT.cvv}
                      inputMode="numeric"
                      type="password"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      placeholder="123"
                      aria-invalid={!!errors.cvv}
                      className={fieldClass("cvv")}
                    />
                    {errors.cvv && <p data-testid={PAYMENT.errorField} className="text-destructive text-sm mt-1.5">{errors.cvv}</p>}
                  </div>
                </div>

                <button
                  data-testid={PAYMENT.submit}
                  type="submit"
                  className="w-full h-12 bg-primary text-primary-foreground font-semibold hover:bg-[#B30015] transition-colors flex items-center justify-center gap-2"
                >
                  <Lock size={16} /> Payer {formatEUR(invoice.amount)}
                </button>
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                  <ShieldCheck size={13} /> Vos données bancaires sont chiffrées et ne sont pas conservées.
                </p>
              </form>
            </motion.div>
          )}

          {phase === "processing" && (
            <motion.div
              key="processing"
              data-testid={PAYMENT.processing}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-live="polite"
              className="bg-white border border-border p-12 text-center"
            >
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <h2 className="font-heading font-bold text-2xl tracking-tight mt-8">
                Traitement de votre paiement sécurisé...
              </h2>
              <p className="text-muted-foreground mt-2">
                Merci de patienter, ne fermez pas cette page.
              </p>
            </motion.div>
          )}

          {phase === "success" && txn && (
            <motion.div
              key="success"
              data-testid={PAYMENT.success}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-border"
            >
              <div className="p-8 text-center border-b border-border">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={34} className="text-green-600" />
                </div>
                <h2 className="font-heading font-extrabold text-3xl tracking-tight mt-5">Paiement confirmé</h2>
                <p className="text-muted-foreground mt-2">
                  Votre facture a bien été réglée. Un reçu est disponible ci-dessous.
                </p>
              </div>

              <div className="p-8 space-y-3">
                {[
                  ["Montant réglé", formatEUR(txn.amount)],
                  ["Date", new Date(txn.created_at).toLocaleString("fr-FR")],
                  ["Référence transaction", txn.reference],
                  ["Numéro de facture", txn.invoice_number],
                  ["Carte", `**** **** **** ${txn.card_last4}`],
                  ["IBAN de prélèvement", txn.iban_masked],
                ].map(([k, v], i) => (
                  <div key={i} className="flex justify-between items-start gap-3 py-2 border-b border-border last:border-0">
                    <span className="text-muted-foreground text-sm shrink-0">{k}</span>
                    <span
                      data-testid={k.startsWith("Référence") ? PAYMENT.successReference : undefined}
                      className="font-medium text-right break-all"
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-8 pt-0 flex flex-col sm:flex-row gap-3">
                <button
                  data-testid={PAYMENT.downloadReceipt}
                  onClick={downloadReceipt}
                  className="flex-1 h-12 border border-input font-semibold hover:bg-secondary transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={17} /> Télécharger le reçu PDF
                </button>
                <button
                  data-testid={PAYMENT.backToInvoices}
                  onClick={() => nav(`/factures/${id}`)}
                  className="flex-1 h-12 bg-primary text-primary-foreground font-semibold hover:bg-[#B30015] transition-colors"
                >
                  Terminer
                </button>
              </div>
            </motion.div>
          )}

          {phase === "failure" && (
            <motion.div
              key="failure"
              data-testid={PAYMENT.failure}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-border p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={34} className="text-primary" />
              </div>
              <h2 className="font-heading font-extrabold text-3xl tracking-tight mt-5">Paiement refusé</h2>
              <p data-testid={PAYMENT.failureMessage} className="text-muted-foreground mt-3 max-w-md mx-auto">
                {failMsg}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <button
                  data-testid={PAYMENT.retry}
                  onClick={() => setPhase("form")}
                  className="flex-1 h-12 bg-primary text-primary-foreground font-semibold hover:bg-[#B30015] transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw size={17} /> Réessayer
                </button>
                <button
                  onClick={() => nav(`/factures/${id}`)}
                  className="flex-1 h-12 border border-input font-semibold hover:bg-secondary transition-colors"
                >
                  Retour à la facture
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
