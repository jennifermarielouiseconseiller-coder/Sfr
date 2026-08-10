import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api, formatEUR, getToken, API } from "@/lib/api";
import { SfrAppBar, SfrFooter } from "@/components/SfrChrome";
import { DETAIL } from "@/constants/testIds";
import {
  Info, XCircle, Calendar, ShieldAlert, Clock, CreditCard, Lock,
  Copy, ChevronDown, RotateCcw, Download, Phone, Building2,
  CheckCircle2,
} from "lucide-react";

function fmtDateTime(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return d; }
}
function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return d; }
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [inv, setInv] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    api.get(`/invoices/${id}`).then((r) => setInv(r.data)).catch(() => nav("/verification"));
  }, [id, nav]);

  const downloadInvoice = async () => {
    const res = await fetch(`${API}/invoices/${id}/facture.pdf`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `facture-${inv.number}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyRef = async () => {
    const text = inv.last_transaction_ref || "";
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      toast.success("Référence copiée");
    } catch (_e) {
      // Fallback: legacy execCommand copy for sandboxed/iframed contexts
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast.success("Référence copiée");
      } catch (_err) {
        toast.error("Impossible de copier la référence");
      }
    }
  };

  if (!inv)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const isPaid = inv.status === "paid";

  return (
    <div className="min-h-screen flex flex-col bg-background" data-testid={DETAIL.screen}>
      <SfrAppBar title="Facture à régler" />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 sfr-fade-up">
        {/* Invoice summary */}
        <div className="bg-white border border-border p-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading font-extrabold text-2xl tracking-tight">{inv.label}</h1>
              <span
                className={`text-xs font-semibold px-2.5 py-1 ${isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-primary"}`}
              >
                {isPaid ? "Payée" : "Impayée"}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              N° {inv.number} · {inv.period} · Échéance {fmtDate(inv.due_date)}
            </p>
          </div>
          <p data-testid={DETAIL.amount} className="font-heading font-extrabold text-3xl text-primary">
            {formatEUR(inv.amount)}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* LEFT column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Failure info */}
            {!isPaid && inv.failure_reason && (
              <div data-testid={DETAIL.failureCard} className="bg-white border border-border p-6">
                <h2 className="font-heading font-bold text-lg flex items-center gap-2 mb-5">
                  <Info size={20} className="text-primary" /> Informations sur l'échec
                </h2>

                <div className="border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                  <XCircle size={20} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-heading font-bold text-primary">Motif de l'échec</p>
                    <p data-testid={DETAIL.failureReason} className="text-neutral-700 text-sm mt-0.5">
                      {inv.failure_reason}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border border border-border mt-4">
                  <div className="bg-white p-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wide">
                      <Calendar size={13} /> Date de l'échec
                    </div>
                    <p data-testid={DETAIL.failureDate} className="font-heading font-bold mt-1 text-sm">
                      {fmtDateTime(inv.failure_date)}
                    </p>
                  </div>
                  <div className="bg-white p-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wide">
                      <ShieldAlert size={13} /> Code erreur
                    </div>
                    <p data-testid={DETAIL.failureCode} className="font-heading font-bold mt-1 text-sm">
                      {inv.failure_code}
                    </p>
                  </div>
                  <div className="bg-white p-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wide">
                      <Clock size={13} /> Tentatives
                    </div>
                    <p data-testid={DETAIL.attempts} className="font-heading font-bold mt-1 text-sm">
                      {inv.attempts} / {inv.max_attempts}
                    </p>
                  </div>
                </div>

                {/* Mandate / payment method */}
                <div className="border border-border mt-4">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                      <CreditCard size={18} className="text-primary" />
                      <span className="font-heading font-semibold">Moyen de paiement</span>
                    </div>
                    <span
                      data-testid={DETAIL.mandateStatus}
                      className={`text-xs font-semibold px-2 py-1 ${inv.mandate_status === "active" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {inv.mandate_status === "active" ? "MANDAT ACTIF" : "MANDAT SUSPENDU"}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="font-heading font-bold">{inv.payment_method}</p>
                    <p className="text-muted-foreground text-sm">Mandat SEPA — débit automatique mensuel</p>
                    <div className="bg-secondary p-4 mt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">IBAN du compte débité</span>
                        <Lock size={13} className="text-muted-foreground" />
                      </div>
                      <p data-testid={DETAIL.ibanMasked} className="font-mono font-semibold tracking-wide mt-1 text-sm sm:text-base break-all">
                        {inv.iban_masked}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Pour des raisons de sécurité, votre IBAN est partiellement masqué.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Transaction ref */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-secondary p-4 mt-4">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Référence transaction</p>
                    <p data-testid={DETAIL.txnRef} className="font-mono font-semibold mt-0.5 break-all">
                      {inv.last_transaction_ref}
                    </p>
                  </div>
                  <button
                    data-testid={DETAIL.copyRef}
                    onClick={copyRef}
                    className="inline-flex items-center justify-center gap-1.5 text-sm border border-input px-3 h-9 bg-white hover:bg-secondary transition-colors shrink-0"
                  >
                    <Copy size={15} /> Copier
                  </button>
                </div>

                {/* History */}
                <button
                  data-testid={DETAIL.history}
                  onClick={() => setShowHistory((s) => !s)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
                >
                  Historique des tentatives
                  <ChevronDown size={16} className={`transition-transform ${showHistory ? "rotate-180" : ""}`} />
                </button>
                {showHistory && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 space-y-2 overflow-hidden"
                  >
                    {(inv.attempt_history || []).map((a, i) => (
                      <li key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-sm border border-border p-3">
                        <span className="flex items-center gap-2">
                          <XCircle size={15} className="text-primary shrink-0" /> {fmtDateTime(a.date)}
                        </span>
                        <span className="text-muted-foreground">{a.reason}</span>
                        <span className="font-mono text-xs text-muted-foreground break-all">{a.ref}</span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </div>
            )}

            {isPaid && (
              <div className="bg-white border border-border p-6 text-center">
                <CheckCircle2 size={40} className="text-green-600 mx-auto" />
                <p className="font-heading font-bold text-lg mt-3">Cette facture est réglée</p>
                <p className="text-muted-foreground mt-1">Aucune action requise.</p>
              </div>
            )}

            {/* Régulariser */}
            {!isPaid && (
              <div data-testid={DETAIL.regulariserCard} className="bg-white border border-border p-6">
                <h2 className="font-heading font-bold text-lg flex items-center gap-2 mb-4">
                  <CreditCard size={20} className="text-primary" /> Régulariser mon paiement
                </h2>
                <div
                  data-testid={DETAIL.cardOption}
                  className="border-2 border-primary bg-red-50/50 p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-primary text-white flex items-center justify-center">
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <p className="font-heading font-bold text-primary">Carte bancaire</p>
                      <p className="text-sm text-muted-foreground">Payez directement par carte Visa, Mastercard ou CB</p>
                    </div>
                  </div>
                  <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center">
                    <CheckCircle2 size={16} />
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-5">
                  <button
                    data-testid={DETAIL.retryPayment}
                    onClick={() => nav(`/paiement/${inv.id}`)}
                    className="flex-1 h-12 bg-primary text-primary-foreground font-semibold hover:bg-[#B30015] transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={17} /> Réessayer le paiement
                  </button>
                  <button
                    data-testid={DETAIL.downloadInvoice}
                    onClick={downloadInvoice}
                    className="flex-1 h-12 border border-input font-semibold hover:bg-secondary transition-colors flex items-center justify-center gap-2"
                  >
                    <Download size={17} /> Télécharger la facture
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT sidebar */}
          <div className="space-y-6">
            <div className="bg-white border border-border p-5">
              <div className="flex items-center gap-2 font-heading font-bold">
                <Building2 size={18} className="text-primary" /> Contactez votre banque
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Votre banque peut avoir bloqué la transaction. Contactez-la pour autoriser le prélèvement SFR.
              </p>
            </div>

            <div className="bg-primary text-white p-6 text-center">
              <div className="w-12 h-12 bg-white/15 rounded-full flex items-center justify-center mx-auto">
                <Phone size={22} />
              </div>
              <p className="font-heading font-bold text-lg mt-3">Besoin d'aide ?</p>
              <p className="text-white/85 text-sm mt-1">Notre service client est à votre disposition</p>
              <button
                data-testid={DETAIL.help1023}
                onClick={() => toast.info("Appelez le 1023 depuis votre mobile SFR.")}
                className="w-full h-11 bg-white text-primary font-semibold mt-4 hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
              >
                <Phone size={16} /> Appeler le 1023
              </button>
              <p className="text-white/70 text-xs mt-2">Du lundi au samedi de 8h à 22h</p>
            </div>

            {inv.next_attempt_date && (
              <div data-testid={DETAIL.nextAttempt} className="bg-amber-50 border border-amber-200 p-5">
                <div className="flex items-center gap-2 font-heading font-bold text-amber-800">
                  <Clock size={18} /> Prochaine tentative
                </div>
                <p className="text-sm text-amber-800/90 mt-2">
                  Un nouveau prélèvement automatique sera effectué le{" "}
                  <span className="font-bold">{fmtDate(inv.next_attempt_date)}</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <SfrFooter />
    </div>
  );
}
