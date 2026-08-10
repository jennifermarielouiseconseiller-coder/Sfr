import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { AUTH } from "@/constants/testIds";
import { AuthShell } from "./ForgotPassword";
import { Lock, CheckCircle, AlertCircle } from "lucide-react";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => nav("/login"), 2500);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Lien invalide" subtitle="Ce lien de réinitialisation est incomplet ou invalide.">
        <Link to="/mot-de-passe-oublie" className="text-primary hover:underline font-medium">
          Refaire une demande
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Nouveau mot de passe"
      subtitle="Choisissez un nouveau mot de passe pour votre compte SFR."
    >
      {done ? (
        <div
          data-testid={AUTH.resetPasswordSuccess}
          className="flex items-start gap-3 bg-green-50 border border-green-200 text-green-800 px-4 py-4 text-sm"
        >
          <CheckCircle size={20} className="mt-0.5 shrink-0 text-green-600" />
          <span>Votre mot de passe a été réinitialisé. Redirection vers la connexion...</span>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {error && (
            <div
              data-testid={AUTH.resetPasswordError}
              role="alert"
              className="flex items-start gap-2 bg-red-50 border border-red-200 text-destructive px-4 py-3 text-sm"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-2">Nouveau mot de passe</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                data-testid={AUTH.resetPassword}
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-10 pr-4 border border-input bg-white focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
                placeholder="Au moins 8 caractères"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Confirmer le mot de passe</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                data-testid={AUTH.resetPasswordConfirm}
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full h-12 pl-10 pr-4 border border-input bg-white focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button
            data-testid={AUTH.resetPasswordSubmit}
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary text-primary-foreground font-semibold hover:bg-[#B30015] transition-colors disabled:opacity-60"
          >
            {loading ? "Enregistrement..." : "Réinitialiser mon mot de passe"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
