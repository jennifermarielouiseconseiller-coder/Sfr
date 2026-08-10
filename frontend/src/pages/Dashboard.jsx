import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatEUR } from "@/lib/api";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { INVOICES } from "@/constants/testIds";
import { FileWarning, ArrowRight, CheckCircle2, Wallet } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/invoices").then((r) => setInvoices(r.data)).finally(() => setLoading(false));
  }, []);

  const unpaid = invoices.filter((i) => i.status === "unpaid");
  const totalDue = unpaid.reduce((s, i) => s + i.amount, 0);

  return (
    <Layout>
      <div className="mb-10">
        <p className="text-muted-foreground">Bonjour {user?.name?.split(" ")[0]},</p>
        <h1 className="font-heading font-extrabold text-4xl tracking-tight mt-1">
          Tableau de bord
        </h1>
      </div>

      <div className="grid sm:grid-cols-3 gap-px bg-border border border-border mb-10">
        <div className="bg-white p-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Wallet size={16} /> Solde à régler
          </div>
          <p data-testid={INVOICES.totalDue} className="font-heading font-extrabold text-3xl mt-2 text-primary">
            {formatEUR(totalDue)}
          </p>
        </div>
        <div className="bg-white p-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <FileWarning size={16} /> Factures impayées
          </div>
          <p data-testid={INVOICES.unpaidCount} className="font-heading font-extrabold text-3xl mt-2">
            {unpaid.length}
          </p>
        </div>
        <div className="bg-white p-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <CheckCircle2 size={16} /> Factures réglées
          </div>
          <p className="font-heading font-extrabold text-3xl mt-2 text-green-600">
            {invoices.length - unpaid.length}
          </p>
        </div>
      </div>

      <div className="bg-white border border-border p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="font-heading font-bold text-xl tracking-tight">
            {unpaid.length > 0 ? "Vous avez des factures à régler" : "Tout est à jour"}
          </h2>
          <p className="text-muted-foreground mt-1">
            {loading
              ? "Chargement..."
              : unpaid.length > 0
              ? `Régularisez vos ${unpaid.length} facture(s) impayée(s) pour un montant total de ${formatEUR(totalDue)}.`
              : "Aucune facture en attente de paiement."}
          </p>
        </div>
        <Link
          to="/factures"
          data-testid={INVOICES.list}
          className="inline-flex items-center gap-2 h-12 px-6 bg-primary text-primary-foreground font-semibold hover:bg-[#B30015] transition-colors shrink-0"
        >
          Voir mes factures <ArrowRight size={18} />
        </Link>
      </div>
    </Layout>
  );
}
