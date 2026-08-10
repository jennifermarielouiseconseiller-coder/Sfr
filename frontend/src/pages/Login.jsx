import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { AUTH } from "@/constants/testIds";
import { SfrLogo } from "@/components/Layout";
import { Lock, User, AlertCircle } from "lucide-react";

const HERO =
  "https://images.unsplash.com/photo-1670272505340-d906d8d77d03?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwxfHxzbWlsaW5nJTIwcGVyc29uJTIwbG9va2luZyUyMGF0JTIwc21hcnRwaG9uZXxlbnwwfHx8fDE3ODMzMjg3OTJ8MA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(identifier, password, remember);
      nav("/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || "Connexion impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={HERO} alt="Espace Client SFR" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-primary/70 mix-blend-multiply" />
        <div className="absolute inset-0 bg-black/25" />
        <div className="relative z-10 h-full flex flex-col justify-between p-12 text-white">
          <SfrLogo size={52} />
          <div>
            <h1 className="font-heading font-extrabold text-5xl leading-tight tracking-tight">
              Votre Espace Client, simple et sécurisé.
            </h1>
            <p className="mt-4 text-white/85 text-lg max-w-md">
              Consultez vos factures, réglez vos paiements et gérez vos offres en toute sérénité.
            </p>
          </div>
          <p className="text-white/60 text-sm">© 2026 SFR — Tous droits réservés</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-white">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden mb-8">
            <SfrLogo size={48} />
          </div>
          <h2 className="font-heading font-bold text-3xl tracking-tight">Connexion</h2>
          <p className="text-muted-foreground mt-2 mb-8">
            Accédez à votre Espace Client SFR
          </p>

          {error && (
            <div
              data-testid={AUTH.loginError}
              role="alert"
              className="flex items-start gap-2 bg-red-50 border border-red-200 text-destructive px-4 py-3 mb-6 text-sm"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Identifiant ou email</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  data-testid={AUTH.loginIdentifier}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full h-12 pl-10 pr-4 border border-input bg-white focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
                  placeholder="votre identifiant"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Mot de passe</label>
                <Link
                  to="/mot-de-passe-oublie"
                  data-testid={AUTH.forgotPasswordLink}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  data-testid={AUTH.loginPassword}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full h-12 pl-10 pr-4 border border-input bg-white focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                data-testid={AUTH.loginRemember}
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 accent-[#E2001A]"
              />
              <span className="text-sm text-muted-foreground">Rester connecté</span>
            </label>

            <button
              data-testid={AUTH.loginSubmit}
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary text-primary-foreground font-semibold hover:bg-[#B30015] transition-colors disabled:opacity-60 flex items-center justify-center"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/identifiant-oublie"
              data-testid={AUTH.forgotIdentifierLink}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Identifiant oublié ?
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
