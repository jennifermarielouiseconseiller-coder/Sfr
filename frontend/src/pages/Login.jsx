import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { AUTH } from "@/constants/testIds";
import { SfrTopBar, SfrFooter } from "@/components/SfrChrome";
import {
  Lock, Eye, EyeOff, ShieldCheck, ChevronRight, AlertTriangle,
  Volume2, RefreshCw, AlertCircle,
} from "lucide-react";

const BG =
  "https://images.unsplash.com/photo-1758874385041-8ed3e1dd7ae4?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600";

const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCaptcha() {
  let s = "";
  for (let i = 0; i < 5; i++)
    s += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
  return s;
}

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [captcha, setCaptcha] = useState(genCaptcha());
  const [captchaInput, setCaptchaInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refreshCaptcha = useCallback(() => {
    setCaptcha(genCaptcha());
    setCaptchaInput("");
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (captchaInput.trim().toUpperCase() !== captcha) {
      setError("Le texte de l'image est incorrect.");
      refreshCaptcha();
      return;
    }
    setLoading(true);
    try {
      await login(identifier, password, remember);
      nav("/factures");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || "Connexion impossible");
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const soon = (label) => toast.info(`« ${label} » sera bientôt disponible.`);

  const links = [
    { label: "Mot de passe oublié", to: "/mot-de-passe-oublie", tid: AUTH.forgotPasswordLink },
    { label: "Compte bloqué", onClick: () => soon("Compte bloqué"), tid: AUTH.compteBloqueLink },
    { label: "Identifiant oublié", to: "/identifiant-oublie", tid: AUTH.forgotIdentifierLink },
    { label: "Première connexion", onClick: () => soon("Première connexion"), tid: AUTH.premiereConnexionLink },
  ];

  const inputCls =
    "w-full h-12 px-4 border border-input bg-white text-[15px] focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SfrTopBar />

      <section className="relative flex-1">
        <img src={BG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/25" />

        <div className="relative max-w-6xl mx-auto px-4 py-10 grid lg:grid-cols-[minmax(0,460px)] gap-6">
          {/* Login card */}
          <div className="bg-white border border-border p-6 sm:p-8 sfr-fade-up">
            <div className="flex items-start justify-between">
              <h1 className="font-heading font-extrabold text-3xl tracking-tight">Espace Client</h1>
              <ShieldCheck size={22} className="text-primary mt-1" />
            </div>
            <p className="italic text-muted-foreground text-sm mt-2 mb-6">
              Tous les champs sont obligatoires
            </p>

            {error && (
              <div
                data-testid={AUTH.loginError}
                role="alert"
                className="flex items-start gap-2 bg-red-50 border border-red-200 text-destructive px-4 py-3 mb-5 text-sm"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block font-heading font-bold mb-2">Identifiant</label>
                <input
                  data-testid={AUTH.loginIdentifier}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  className={inputCls}
                  placeholder="Numéro de ligne mobile, email ou NeufID"
                />
              </div>

              <div>
                <label className="block font-heading font-bold mb-2">Mot de passe</label>
                <div className="relative">
                  <input
                    data-testid={AUTH.loginPassword}
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className={`${inputCls} pr-12`}
                    placeholder="Saisir le mot de passe"
                  />
                  <button
                    type="button"
                    data-testid={AUTH.loginPasswordToggle}
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPwd ? "Masquer" : "Afficher"}
                  >
                    {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  data-testid={AUTH.loginRemember}
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-5 h-5 accent-green-600"
                />
                <span className="text-[15px]">Rester connecté</span>
              </label>

              {/* Captcha */}
              <div className="border border-input p-3">
                <div className="flex items-center gap-3">
                  <Volume2 size={20} className="text-neutral-700 shrink-0" />
                  <div
                    data-testid={AUTH.loginCaptchaCode}
                    className="flex-1 h-14 flex items-center justify-center select-none overflow-hidden"
                    style={{
                      background:
                        "repeating-linear-gradient(45deg, #efe7d6, #efe7d6 8px, #e5dcc8 8px, #e5dcc8 16px)",
                    }}
                  >
                    <span
                      className="font-heading font-extrabold text-3xl tracking-[0.35em] text-neutral-700"
                      style={{ transform: "skewX(-8deg)", textShadow: "1px 1px 0 rgba(0,0,0,0.15)" }}
                    >
                      {captcha}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    data-testid={AUTH.loginCaptcha}
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    required
                    className="flex-1 h-11 px-4 border border-input bg-white focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
                    placeholder="Saisir le texte de l'image"
                  />
                  <button
                    type="button"
                    data-testid={AUTH.loginCaptchaRefresh}
                    onClick={refreshCaptcha}
                    className="w-11 h-11 border border-input flex items-center justify-center text-primary hover:bg-secondary transition-colors"
                    aria-label="Rafraîchir le captcha"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
              </div>

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

            <div className="bg-secondary mt-6 -mx-6 sm:-mx-8 px-6 sm:px-8 py-5 space-y-3">
              {links.map((l) =>
                l.to ? (
                  <Link
                    key={l.label}
                    to={l.to}
                    data-testid={l.tid}
                    className="flex items-center gap-1.5 font-heading font-bold text-primary hover:underline"
                  >
                    {l.label} <ChevronRight size={16} />
                  </Link>
                ) : (
                  <button
                    key={l.label}
                    type="button"
                    data-testid={l.tid}
                    onClick={l.onClick}
                    className="flex items-center gap-1.5 font-heading font-bold text-primary hover:underline"
                  >
                    {l.label} <ChevronRight size={16} />
                  </button>
                )
              )}
            </div>
          </div>

          {/* Emergency card */}
          <div className="bg-white border border-border p-6 text-center max-w-[460px] sfr-fade-up">
            <AlertTriangle size={34} className="text-warning mx-auto" style={{ color: "#F59E0B" }} />
            <p className="font-heading font-bold text-lg mt-3">Mobile perdu ou volé, SIM bloquée</p>
            <button
              data-testid={AUTH.urgenceLink}
              onClick={() => soon("Actes d'urgence")}
              className="inline-flex items-center gap-1.5 font-heading font-bold text-primary hover:underline mt-3"
            >
              Accéder aux actes d'urgence <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      <SfrFooter />
    </div>
  );
}
