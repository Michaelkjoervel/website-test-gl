import { NavLink, Outlet, useLocation } from "react-router-dom";

const nav = [
  { to: "/", label: "Dashboard", icon: DashboardIcon },
  { to: "/nyt-estimat", label: "Nyt estimat", icon: PlusIcon },
  { to: "/historik", label: "Historik", icon: ListIcon },
  { to: "/import", label: "Importér data", icon: ImportIcon },
];

export function AppShell() {
  const loc = useLocation();
  const pageTitle =
    nav.find((n) =>
      n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to),
    )?.label ?? "Estimat";

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-surface-line bg-white">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-surface-line">
          <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold text-sm shadow-glow">
            gl
          </div>
          <div className="leading-tight">
            <div className="font-bold text-ink text-[15px]">green light</div>
            <div className="text-[11px] text-ink-mute">Estimatværktøj</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <span className="text-ink-soft">
                <n.icon />
              </span>
              <span>{n.label}</span>
              <span className="ml-auto nav-dot" />
            </NavLink>
          ))}
        </nav>

        <div className="px-6 py-5 border-t border-surface-line">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">
            Version
          </div>
          <div className="text-xs text-ink-soft">v0.1 · placeholder-data</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-surface-line">
          <div className="flex items-center justify-between px-6 md:px-10 py-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-mute">
                green light · estimat
              </div>
              <h1 className="text-xl font-bold text-ink mt-0.5">{pageTitle}</h1>
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
