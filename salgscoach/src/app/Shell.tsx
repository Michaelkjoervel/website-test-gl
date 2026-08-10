// =============================================================================
// app/Shell · Rammen om alt undtagen selve samtalen
// -----------------------------------------------------------------------------
// Navigationen er bevidst kort. En sælger skal kunne åbne værktøjet og forstå
// det på to sekunder: Træn · Min udvikling · Historik · Materiale (· Ledelse).
// Under en øvelse forsvinder rammen helt — se App.tsx.
// =============================================================================

import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";
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
  const items = isManager ? [...MAIN, ...MANAGER] : MAIN;

  return (
    <div className="flex min-h-full">
      {/* --------------------------------------------------------- Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-base-line bg-base-raise/70 lg:flex">
        <Brand />
        <nav className="flex-1 space-y-1 px-3 py-4">
          {items.map((n) => (
            <NavRow key={n.to} item={n} />
          ))}
        </nav>
        <SellerFooter onSignOut={signOut} initials={seller?.initials || "?"} name={seller?.name || ""} isManager={isManager} />
      </aside>

      {/* ------------------------------------------------------- Hovedområde */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-base-line bg-base/80 px-4 py-3 backdrop-blur lg:hidden">
          <button className="btn-ghost btn-sm -ml-2" onClick={() => setOpen(true)} aria-label="Åbn menu">
            <Icon.Menu width={18} height={18} />
          </button>
          <span className="font-bold tracking-tight">
            green light <span className="text-brand-400">Salgscoach</span>
          </span>
          <span className="ml-auto">
            <Avatar initials={seller?.initials || "?"} size={30} />
          </span>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-10">
          <Outlet key={loc.pathname} />
        </main>
      </div>

      {/* ------------------------------------------------------ Mobilmenu */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-base-line bg-base-raise animate-fade-up">
            <Brand />
            <nav className="flex-1 space-y-1 px-3 py-4" onClick={() => setOpen(false)}>
              {items.map((n) => (
                <NavRow key={n.to} item={n} />
              ))}
            </nav>
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

function Brand() {
  return (
    <div className="flex items-center gap-3 border-b border-base-line px-5 py-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand-700 bg-brand-950 font-bold text-brand-400">
        gl
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold text-ink">green light</span>
        <span className="block text-xs text-brand-400">Salgscoach</span>
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
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? "bg-brand-950 text-ink ring-1 ring-inset ring-brand-800"
            : "text-ink-soft hover:bg-base-panel hover:text-ink"
        }`
      }
    >
      <I width={18} height={18} />
      {item.label}
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
    <div className="border-t border-base-line px-3 py-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <Avatar initials={initials} size={34} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold text-ink">{name || initials}</div>
          <div className="text-xs text-ink-mute">{isManager ? "Salgsledelse" : "Sælger"}</div>
        </div>
        <button className="btn-ghost btn-sm px-2" onClick={onSignOut} title="Log ud" aria-label="Log ud">
          <Icon.Logout width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
