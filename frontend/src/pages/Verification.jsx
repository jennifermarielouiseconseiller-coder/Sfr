import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { AUTH } from "@/constants/testIds";
import { SfrTopBar, SfrFooter } from "@/components/SfrChrome";
import {
  ShieldCheck, Phone, Mail, AlertCircle, Lock, ChevronRight, UserCheck,
} from "lucide-react";

const BG =
  "https://images.unsplash.com/photo-1758874385041-8ed3e1dd7ae4?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600";

/* Light formatting for a French phone number (keeps + and digits, groups by 2). */
function formatPhone(v) {
  let s = v.replace(/[^\d+]/g, "");
  if (s.startsWith("+")) {
    const rest = s.slice(1).replace(/\D/g, "").slice(0, 12);
    return "+" + rest.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  s = s.replace(/\D/g, "").slice(0, 10);
  return s.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

export default function Verification() {
  const { verify } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) {
      setError("Veuillez saisir un numéro de téléphone valide.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Veuillez saisir une adresse email valide.");
      return;
    }
    setLoading(true);
    try {
      const data = await verify(phone.trim(), email.trim());
      toast.success("Identité vérifiée. Un email de confirmation vous a été envoyé.");
      nav(`/factures/${data.invoice_id}`);
    } catch (err) {
      setError(
        formatApiError(err.response?.data?.detail) ||
          "La vérification a échoué. Veuillez réessayer."
      );
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full h-12 pl-11 pr-4 border border-input bg-white text-[15px] focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SfrTopBar />

      <section className="relative flex-1 flex">
        <img src={BG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/30" />

        <div className="relative w-full max-w-6xl mx-auto px-4 py-8 sm:py-12 flex items-center justify-center">
          <div className="w-full max-w-[460px] bg-white border border-border p-5 sm:p-8 shadow-xl sfr-fade-up">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight">
                  Vérification d'identité
                </h1>
                <p className="text-muted-foreground text-sm mt-2">
                  Pour accéder à votre Espace Client et régulariser votre situation, confirmez
                  que vous êtes bien le titulaire de la ligne.
                </p>
              </div>
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-primary text-white flex items-center justify-center shrink-0">
                <UserCheck size={22} />
              </div>
            </div>

            {error && (
              <div
                data-testid={AUTH.verifyError}
                role="alert"
                className="flex items-start gap-2 bg-red-50 border border-red-200 text-destructive px-4 py-3 mt-6 text-sm"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submit} className="space-y-5 mt-6">
              <div>
                <label className="block font-heading font-bold mb-2">
                  Numéro de téléphone
                </label>
                <div className="relative">
                  <Phone
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    data-testid={AUTH.verifyPhone}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    required
                    className={inputCls}
                    placeholder="06 12 34 56 78"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Le numéro de la ligne mobile ou fixe rattachée à votre compte.
                </p>
              </div>

              <div>
                <label className="block font-heading font-bold mb-2">Adresse email</label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    data-testid={AUTH.verifyEmail}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputCls}
                    placeholder="prenom.nom@email.com"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Un email de confirmation de connexion vous y sera envoyé.
                </p>
              </div>

              <div className="flex items-start gap-2 bg-secondary p-3 text-sm text-muted-foreground">
                <ShieldCheck size={18} className="text-green-600 mt-0.5 shrink-0" />
                <span>
                  Vos informations sont protégées et utilisées uniquement pour sécuriser
                  l'accès à votre Espace Client.
                </span>
              </div>

              <button
                data-testid={AUTH.verifySubmit}
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-primary text-primary-foreground font-semibold hover:bg-[#B30015] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock size={16} /> Vérifier mon identité
                  </>
                )}
              </button>
            </form>

            <div className="bg-secondary mt-6 -mx-5 sm:-mx-8 px-5 sm:px-8 py-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <ChevronRight size={16} className="text-primary shrink-0" />
              Cette vérification garantit que vous êtes le titulaire légitime du compte.
            </div>
          </div>
        </div>
      </section>

      <SfrFooter />
    </div>
  );
}
