import { useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { AUTH } from "@/constants/testIds";
import { AuthShell } from "./ForgotPassword";
import { Mail, CheckCircle } from "lucide-react";

export default function ForgotIdentifier() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-identifier", { email });
      setMsg(data.message);
    } catch (err) {
      setMsg(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Identifiant oublié"
      subtitle="Saisissez l'email de votre compte. Nous vous rappellerons votre identifiant de connexion par email."
    >
      {msg ? (
        <div
          data-testid={AUTH.forgotIdentifierSuccess}
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
                data-testid={AUTH.forgotIdentifierEmail}
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
            data-testid={AUTH.forgotIdentifierSubmit}
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary text-primary-foreground font-semibold hover:bg-[#B30015] transition-colors disabled:opacity-60"
          >
            {loading ? "Envoi..." : "Recevoir mon identifiant"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
