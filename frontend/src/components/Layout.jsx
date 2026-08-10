import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { APP, AUTH } from "@/constants/testIds";
import { LogOut, LayoutDashboard, FileText } from "lucide-react";

export const SfrLogo = ({ size = 40 }) => (
  <span
    data-testid={APP.logo}
    className="sfr-logo"
    style={{ width: size, height: size, fontSize: size * 0.42 }}
  >
    SFR
  </span>
);

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    logout();
    nav("/login");
  };

  const links = [
    { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, tid: APP.navDashboard },
    { to: "/factures", label: "Factures impayées", icon: FileText, tid: APP.navInvoices },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header
        data-testid={APP.header}
        className="bg-white border-b border-border sticky top-0 z-40"
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-3">
              <SfrLogo size={38} />
              <span className="font-heading font-bold text-lg tracking-tight hidden sm:block">
                Espace Client
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {links.map((l) => {
                const active = pathname === l.to;
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    data-testid={l.tid}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <l.icon size={16} />
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-muted-foreground hidden sm:block">
                {user.name}
              </span>
            )}
            <button
              data-testid={AUTH.logoutButton}
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 sfr-fade-up">{children}</main>
    </div>
  );
};
