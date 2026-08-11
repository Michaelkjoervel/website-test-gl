// =============================================================================
// app/Shell · Rammen om alt undtagen selve samtalen
// -----------------------------------------------------------------------------
// Navigationen er bevidst kort. En sælger skal kunne åbne værktøjet og forstå
// det på to sekunder: Træn · Min udvikling · Historik · Materiale (· Ledelse).
// Under en øvelse forsvinder rammen helt — se App.tsx.
// =============================================================================

import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../ui/icons";
import { Avatar } from "../ui/primitives";
import { useAuth } from "../lib/auth";

type NavItem = { to: string; label: string; icon: (p: { width?: number; height?: number }) => ReactNode };

const MAIN: NavItem[] = [
  { to: "/", label: "Træn", icon: Icon.Mic },
  { to: "/udvikling", label: "Min udvikling", icon: Icon.Chart },
  { to: "/historik", label: "Historik", icon: Icon.History },
  { to: "/materiale", label: "Salgsmateriale", icon: Icon.Doc },
  { to: "/manual", label: "Salgsmanualen", icon: Icon.Book },
];

const MANAGER: NavItem[] = [{ to: "/ledelse", label: "Ledelse", icon: Icon.Users }];

export function Shell() {
  const { seller, isManager, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  /* Menuen på telefonen skal kunne lukkes med tastaturet, og siden bagved må
     ikke kunne rulle imens. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="flex min-h-full">
      {/* --------------------------------------------------------- Sidebar */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-base-line bg-base-raise/60 lg:flex">
        <Brand />
        <Nav isManager={isManager} />
        <SellerFooter
          onSignOut={signOut}
          initials={seller?.initials || "?"}
          name={seller?.name || ""}
          isManager={isManager}
        />
      </aside>

      {/* ------------------------------------------------------- Hovedområde */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-t sticky top-0 z-30 border-b border-base-line bg-base/90 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              className="btn-ghost btn-icon"
              onClick={() => setOpen(true)}
              aria-label="Åbn menu"
              aria-expanded={open}
            >
              <Icon.Menu width={20} height={20} />
            </button>
            <span className="text-[15px] font-bold tracking-tight">
              green light <span className="text-brand-400">Salgscoach</span>
            </span>
            <span className="ml-auto pr-1">
              <Avatar initials={seller?.initials || "?"} size={32} />
            </span>
          </div>
        </header>

        <main className="page-x mx-auto w-full max-w-[1080px] flex-1 py-8 md:py-12">
          <Outlet key={loc.pathname} />
        </main>
      </div>

      {/* ------------------------------------------------------ Mobilmenu */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div
            className="safe-t absolute left-0 top-0 flex h-full w-[272px] flex-col border-r border-base-line bg-base-raise"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="flex items-center justify-between border-b border-base-line pr-2">
              <Brand />
              <button className="btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label="Luk menu">
                <Icon.X width={18} height={18} />
              </button>
            </div>
            <Nav isManager={isManager} onNavigate={() => setOpen(false)} />
            <SellerFooter
              onSignOut={signOut}
              initials={seller?.initials || "?"}
              name={seller?.name || ""}
              isManager={isManager}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Nav({ isManager, onNavigate }: { isManager: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-5" onClick={onNavigate}>
      <div className="eyebrow px-3 pb-2">Træning</div>
      <div className="space-y-0.5">
        {MAIN.map((n) => (
          <NavRow key={n.to} item={n} />
        ))}
      </div>
      {isManager && (
        <>
          <div className="eyebrow px-3 pb-2 pt-6">Salgsledelse</div>
          <div className="space-y-0.5">
            {MANAGER.map((n) => (
              <NavRow key={n.to} item={n} />
            ))}
          </div>
        </>
      )}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-base-line px-5 py-[18px] lg:border-b">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-800 bg-brand-950 text-sm font-bold text-brand-400">
        gl
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-bold text-ink">green light</span>
        <span className="block truncate text-xs text-brand-400">Salgscoach</span>
      </span>
    </div>
  );
}

function NavRow({ item }: { item: NavItem }) {
  const I = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        `relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
          isActive
            ? "bg-base-panel text-ink"
            : "text-ink-soft hover:bg-base-panel/60 hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Den aktive side markeres med green lights grønne — én ting ad
              gangen, så farven bliver ved med at betyde noget. */}
          <span
            className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-colors ${
              isActive ? "bg-brand-500" : "bg-transparent"
            }`}
            aria-hidden="true"
          />
          <span className={isActive ? "text-brand-400" : "text-ink-mute"}>
            <I width={18} height={18} />
          </span>
          {item.label}
        </>
      )}
    </NavLink>
  );
}

function SellerFooter({
  initials,
  name,
  isManager,
  onSignOut,
}: {
  initials: string;
  name: string;
  isManager: boolean;
  onSignOut: () => void;
}) {
  return (
    <div className="pad-b-safe border-t border-base-line px-3 pt-3">
      <div className="flex items-center gap-3 px-2 py-1">
        <Avatar initials={initials} size={34} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold text-ink">{name || initials}</div>
          <div className="truncate text-xs text-ink-mute">{isManager ? "Salgsledelse" : "Sælger"}</div>
        </div>
        <button className="btn-ghost btn-icon btn-sm" onClick={onSignOut} title="Log ud" aria-label="Log ud">
          <Icon.Logout width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
