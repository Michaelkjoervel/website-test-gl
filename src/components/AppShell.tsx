import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { usePricing } from "./PricingProvider";

type NavItem = { to: string; label: string; icon: () => JSX.Element };

const navSections: { heading?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: "/", label: "Dashboard", icon: DashboardIcon },
      { to: "/nyt-estimat", label: "Nyt estimat", icon: PlusIcon },
      { to: "/historik", label: "Historik", icon: ListIcon },
      { to: "/import", label: "Importér data", icon: ImportIcon },
    ],
  },
  {
    heading: "Visualisering",
    items: [
      { to: "/univers", label: "Universet", icon: GridIcon },
      { to: "/ny-visualisering", label: "Ny visualisering", icon: SparkIcon },
      { to: "/visualiseringer", label: "Visualiseringer", icon: GalleryIcon },
    ],
  },
  {
    heading: "Administration",
    items: [{ to: "/prisdata", label: "Prisdata", icon: TagIcon }],
  },
];

// Sidetitel: længste matchende nav-sti, med særlige detalje-ruter.
function resolveTitle(pathname: string): string {
  if (pathname.startsWith("/visualisering/")) return "Visualisering";
  if (pathname.startsWith("/estimat/")) return "Estimat";
  const items = navSections.flatMap((s) => s.items);
  const match = items
    .filter((n) => (n.to === "/" ? pathname === "/" : pathname === n.to || pathname.startsWith(n.to + "/")))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label ?? "green light";
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
      {navSections.map((section, si) => (
        <div key={si} className="space-y-1">
          {section.heading && (
            <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-mute">
              {section.heading}
            </div>
          )}
          {section.items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              onClick={onNavigate}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <span className="text-ink-soft">
                <n.icon />
              </span>
              <span>{n.label}</span>
              <span className="ml-auto nav-dot" />
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold text-sm shadow-glow">
        gl
      </div>
      <div className="leading-tight">
        <div className="font-bold text-ink text-[15px]">green light</div>
        <div className="text-[11px] text-ink-mute">Estimatværktøj</div>
      </div>
    </div>
  );
}

export function AppShell() {
  const loc = useLocation();
  const pageTitle = resolveTitle(loc.pathname);
  const { session, user, signOut } = useAuth();
  const { source } = usePricing();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Luk mobilmenuen ved rutenavigation (også via browserens tilbage-knap).
  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-64 flex-col border-r border-surface-line bg-white">
        <div className="px-6 py-5 border-b border-surface-line">
          <BrandMark />
        </div>

        <NavList />

        <div className="px-6 py-5 border-t border-surface-line">
          {session ? (
            <div className="mb-3">
              <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Logget ind</div>
              <div className="text-xs text-ink-soft truncate">{user?.email}</div>
              <button onClick={() => signOut()} className="mt-1 text-xs font-medium text-brand-700 hover:underline">
                Log ud
              </button>
            </div>
          ) : null}
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">
            Version
          </div>
          <div className="text-xs text-ink-soft">
            v0.1 ·{" "}
            {source === "cloud" ? (
              <span className="text-brand-700 font-medium">cloud-priser</span>
            ) : (
              "placeholder-priser"
            )}
          </div>
        </div>
      </aside>

      {/* Mobilmenu (skuffe) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-card flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-line">
              <BrandMark />
              <button className="btn-ghost px-2 py-1" onClick={() => setMobileOpen(false)} aria-label="Luk menu">
                ✕
              </button>
            </div>
            <NavList onNavigate={() => setMobileOpen(false)} />
            {session && (
              <div className="px-5 py-4 border-t border-surface-line">
                <div className="text-xs text-ink-soft truncate">{user?.email}</div>
                <button onClick={() => signOut()} className="mt-1 text-xs font-medium text-brand-700 hover:underline">
                  Log ud
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-surface-line">
          <div className="flex items-center justify-between gap-3 px-4 md:px-10 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="md:hidden shrink-0 w-10 h-10 rounded-xl border border-surface-line bg-white flex items-center justify-center text-ink-soft"
                onClick={() => setMobileOpen(true)}
                aria-label="Menu"
              >
                <MenuIcon />
              </button>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-ink-mute">
                  green light · estimat
                </div>
                <h1 className="text-xl font-bold text-ink mt-0.5 truncate">{pageTitle}</h1>
              </div>
            </div>
            <NavLink to="/nyt-estimat" className="btn-primary hidden sm:inline-flex">
              <PlusIcon /> Nyt estimat
            </NavLink>
          </div>
        </header>
        <main className="flex-1 px-4 md:px-10 py-6 md:py-8 max-w-[1280px] w-full mx-auto">
          <Outlet />
        </main>
        <footer className="px-6 md:px-10 py-6 text-[11px] text-ink-mute border-t border-surface-line bg-white/40">
          green light a/s · vejledende estimat. Ikke et bindende tilbud.
        </footer>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l1.8 4.7L18.5 9l-4.7 1.3L12 15l-1.8-4.7L5.5 9l4.7-1.3L12 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M18 15l.9 2.3 2.3.9-2.3.7L18 21l-.7-2.1-2.3-.7 2.3-.9L18 15z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 14l4-4 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 12l-8 8-9-9V4h7l10 8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" />
    </svg>
  );
}
