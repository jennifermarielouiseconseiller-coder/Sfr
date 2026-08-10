import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatEUR, getToken, API } from "@/lib/api";
import { Layout } from "@/components/Layout";
import { INVOICES } from "@/constants/testIds";
import { FileText, Download, CreditCard, CheckCircle2, Calendar } from "lucide-react";

function formatDate(d) {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return d;
  }
}

export default function Invoices() {
  const nav = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/invoices").then((r) => setInvoices(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const downloadReceipt = async (inv) => {
    const res = await fetch(`${API}/invoices/${inv.id}/receipt.pdf`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recu-${inv.number}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const unpaid = invoices.filter((i) => i.status === "unpaid");
  const paid = invoices.filter((i) => i.status === "paid");

  const Row = ({ inv }) => (
    <div
      data-testid={INVOICES.card}
      className="bg-white border border-border p-6 flex flex-col md:flex-row md:items-center gap-5 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start gap-4 flex-1">
        <div className="w-11 h-11 bg-secondary flex items-center justify-center shrink-0">
          <FileText size={20} className="text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <span className="font-heading font-bold text-lg tracking-tight">{inv.label}</span>
            <span
              data-testid={INVOICES.status}
              className={`text-xs font-semibold px-2.5 py-1 ${
                inv.status === "paid"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-primary"
              }`}
            >
              {inv.status === "paid" ? "Payée" : "Impayée"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            N° {inv.number} · {inv.period}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <Calendar size={13} /> Échéance : {formatDate(inv.due_date)}
          </p>
        </div>
      </div>

      <div className="text-left md:text-right">
        <p className="font-heading font-extrabold text-2xl tracking-tight">{formatEUR(inv.amount)}</p>
      </div>

      <div className="md:w-52 flex md:justify-end">
        {inv.status === "unpaid" ? (
          <button
            data-testid={INVOICES.payButton}
            onClick={() => nav(`/paiement/${inv.id}`)}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 w-full md:w-auto bg-primary text-primary-foreground font-semibold hover:bg-[#B30015] transition-colors"
          >
            <CreditCard size={17} /> Régulariser mon paiement
          </button>
        ) : (
          <button
            data-testid={INVOICES.receiptButton}
            onClick={() => downloadReceipt(inv)}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 w-full md:w-auto border border-input font-semibold hover:bg-secondary transition-colors"
          >
            <Download size={17} /> Reçu PDF
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="font-heading font-extrabold text-4xl tracking-tight">Mes factures</h1>
        <p className="text-muted-foreground mt-2">
          Consultez et réglez vos factures SFR en ligne.
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="font-heading font-bold text-lg mb-4 flex items-center gap-2">
              Factures impayées
              <span className="text-sm text-muted-foreground font-normal">({unpaid.length})</span>
            </h2>
            {unpaid.length === 0 ? (
              <div
                data-testid={INVOICES.emptyState}
                className="bg-white border border-border p-10 text-center"
              >
                <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
                <p className="font-heading font-semibold text-lg">Aucune facture impayée</p>
                <p className="text-muted-foreground mt-1">Toutes vos factures sont à jour.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {unpaid.map((inv) => (
                  <Row key={inv.id} inv={inv} />
                ))}
              </div>
            )}
          </section>

          {paid.length > 0 && (
            <section>
              <h2 className="font-heading font-bold text-lg mb-4 flex items-center gap-2">
                Factures réglées
                <span className="text-sm text-muted-foreground font-normal">({paid.length})</span>
              </h2>
              <div className="space-y-4">
                {paid.map((inv) => (
                  <Row key={inv.id} inv={inv} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Layout>
  );
}
