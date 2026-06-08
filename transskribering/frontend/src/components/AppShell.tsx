import { Link, NavLink } from "react-router-dom";

interface Props {
  children: React.ReactNode;
}

export function AppShell({ children }: Props) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="2" width="12" height="14" rx="6" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
              </svg>
            </div>
            <div>
              <div className="text-base font-semibold text-slate-900">Transskribering</div>
              <div className="text-xs text-slate-500">Dansk tale til tekst</div>
            </div>
          </Link>
          <nav className="flex gap-1 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:text-slate-900"
                }`
              }
            >
              Ny transskribering
            </NavLink>
            <NavLink
              to="/historik"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:text-slate-900"
                }`
              }
            >
              Mine transskriberinger
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-slate-400 sm:px-6">
        Lydoptagelser behandles for at generere en transskribering. Originale lydfiler slettes automatisk efter den
        valgte opbevaringsperiode.
      </footer>
    </div>
  );
}
