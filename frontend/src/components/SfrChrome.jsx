import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { APP, AUTH } from "@/constants/testIds";
import {
  Search, ShoppingBag, Mail, User, Menu, ChevronDown,
  Facebook, Twitter, Youtube, ExternalLink, LogOut,
} from "lucide-react";

export const SfrLogo = ({ size = 40 }) => (
  <span
    data-testid={APP.logo}
    className="sfr-logo"
    style={{ width: size * 1.35, height: size, fontSize: size * 0.5 }}
  >
    SFR
  </span>
);

/* Public marketing-style top bar (login pages) */
export const SfrTopBar = () => (
  <header data-testid={APP.header} className="bg-white border-b border-border sticky top-0 z-40">
    <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
      <Link to="/login" className="flex items-center">
        <SfrLogo size={34} />
      </Link>
      <div className="flex items-center gap-5 text-neutral-800">
        <Search size={22} className="cursor-pointer hover:text-primary transition-colors" />
        <ShoppingBag size={22} className="cursor-pointer hover:text-primary transition-colors" />
        <Mail size={22} className="cursor-pointer hover:text-primary transition-colors" />
        <User size={22} className="text-primary cursor-pointer" />
        <Menu size={24} className="cursor-pointer hover:text-primary transition-colors" />
      </div>
    </div>
  </header>
);

/* Authenticated slim bar with page title */
export const SfrAppBar = ({ title }) => {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header data-testid={APP.header} className="bg-white border-b border-border sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/factures"><SfrLogo size={32} /></Link>
          {title && (
            <span className="font-heading font-semibold text-lg tracking-tight border-l border-border pl-4">
              {title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Link to="/factures" data-testid={APP.navInvoices} className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors hidden sm:block">
            Factures
          </Link>
          <button
            data-testid={AUTH.logoutButton}
            onClick={() => { logout(); nav("/login"); }}
            title="Déconnexion"
            className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center hover:bg-[#B30015] transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};

const FOOTER_SECTIONS = {
  "S'informer": ["Nos offres Mobile", "Nos offres Box", "Réseau & couverture", "Actualités SFR"],
  "Aide": ["Assistance", "Suivi de commande", "Résiliation", "Nous contacter"],
  "Espace Client": ["Mes factures", "Mon forfait", "Mes options", "Mes paramètres"],
  "Contacts": ["Service client", "Boutiques SFR", "Réclamations", "Recrutement"],
  "Pro / Entreprise": ["SFR Business", "Solutions Cloud", "Téléphonie d'entreprise"],
};

export const SfrFooter = () => (
  <footer data-testid={APP.footer} className="bg-neutral-900 text-white mt-16">
    <div className="max-w-6xl mx-auto px-4 divide-y divide-white/10">
      {Object.entries(FOOTER_SECTIONS).map(([title, items]) => (
        <details key={title} className="group">
          <summary className="flex items-center justify-between py-5 cursor-pointer list-none font-heading font-bold text-lg">
            {title}
            <ChevronDown size={20} className="transition-transform group-open:rotate-180" />
          </summary>
          <ul className="pb-5 space-y-2">
            {items.map((i) => (
              <li key={i}>
                <span className="text-white/70 text-sm hover:text-white transition-colors cursor-pointer">{i}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>

    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 border-t border-white/10">
      <SfrLogo size={40} />
      <div className="flex items-center gap-4">
        <span className="font-heading font-bold">Suivez-nous sur</span>
        <div className="flex items-center gap-3">
          {[Facebook, Twitter, Youtube].map((Icon, i) => (
            <span key={i} className="w-9 h-9 border border-white/25 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">
              <Icon size={16} />
            </span>
          ))}
        </div>
      </div>
    </div>

    <div className="border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
        {["Informations légales", "Plan du site", "Politique cookies", "Gestion cookies", "Données personnelles", "Emplois", "Altice France"].map((l) => (
          <span key={l} className="hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1">
            {l}
            {(l === "Emplois" || l === "Altice France") && <ExternalLink size={12} />}
          </span>
        ))}
      </div>
    </div>
  </footer>
);
