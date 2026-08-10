import { useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { AUTH } from "@/constants/testIds";
import { SfrLogo } from "@/components/Layout";
import { Mail, CheckCircle, ArrowLeft } from "lucide-react";

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md bg-white border border-border p-8 sm:p-10 sfr-fade-up">
        <SfrLogo size={44} />
        <h1 className="font-heading font-bold text-2xl tracking-tight mt-6">{title}</h1>
        <p className="text-muted-foreground mt-2 mb-8">{subtitle}</p>
        {children}
        <div className="mt-8">
          <Link
            to="/login"
            data-testid={AUTH.backToLoginLink}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
          >
            <ArrowLeft size={16} /> Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMsg(data.message);
    } catch (err) {
      setMsg(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Saisissez l'email de votre compte. Nous vous enverrons un lien pour réinitialiser votre mot de passe."
    >
      {msg ? (
        <div
          data-testid={AUTH.forgotPasswordSuccess}
          className="flex items-start gap-3 bg-green-50 border border-green-200 text-green-800 px-4 py-4 text-sm"
        >
          <CheckCircle size={20} className="mt-0.5 shrink-0 text-green-600" />
          <span>{msg}</span>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Adresse email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                data-testid={AUTH.forgotPasswordEmail}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 pl-10 pr-4 border border-input bg-white focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
                placeholder="vous@exemple.com"
              />
            </div>
          </div>
          <button
            data-testid={AUTH.forgotPasswordSubmit}
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary text-primary-foreground font-semibold hover:bg-[#B30015] transition-colors disabled:opacity-60"
          >
            {loading ? "Envoi..." : "Envoyer le lien"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export { AuthShell };
