// =============================================================================
// auth · login, identitet og adgangsspærring
// -----------------------------------------------------------------------------
// Samme opbygning som resten af huset (AuthProvider + RequireAuth), men med to
// tilføjelser Salgscoachen ikke kan undvære:
//
//   1) SÆLGEREN. Et login er ikke nok — appen skal vide HVEM der træner
//      (initialer, navn, rolle), fordi hele hukommelsen og feedbacken hænger
//      på den person. Derfor opløses brugeren til en Seller (se sellers.ts),
//      og lageret får besked (store.setActiveSeller), så privatlivsreglerne
//      håndhæves i klienten.
//
//   2) LOKAL TILSTAND. Er Supabase ikke sat op (eller VITE_SUPABASE_URL=off),
//      kører appen videre med en tydeligt mærket lokal tilstand og en
//      sælgervælger, så flowet kan demonstreres uden server. Data bliver i
//      browseren — det siger vi højt i UI'et.
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { authEnabled, supabase } from "./supabase";
import {
  clearSellerCache,
  initialsOf,
  isManagerEmail,
  listSellers,
  makeLocalSeller,
  resolveSeller,
  seedSellers,
  sellerAvatar,
} from "./sellers";
import { setActiveSeller } from "./store";
import type { Seller, UserRole } from "./types";

const LOCAL_SELLER_KEY = "gl.coach.localSeller.v1";

export interface AuthState {
  /** false = lokal tilstand (ingen Supabase). */
  authEnabled: boolean;
  /** true mens vi endnu ikke ved hvem brugeren er. */
  loading: boolean;
  session: Session | null;
  user: User | null;
  /** Den sælger appen træner lige nu — null indtil identiteten er kendt. */
  seller: Seller | null;
  role: UserRole;
  isManager: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Hent sælgeren forfra (fx efter en rettelse i coach_users). */
  refreshSeller: () => Promise<void>;
  /* --- kun relevant i lokal tilstand ------------------------------------ */
  localMode: boolean;
  /** Sælgere man kan vælge imellem i lokal tilstand. */
  sellers: Seller[];
  setLocalSeller: (seller: Seller) => void;
}

const noop = async () => {};

const AuthContext = createContext<AuthState>({
  authEnabled,
  loading: false,
  session: null,
  user: null,
  seller: null,
  role: "saelger",
  isManager: false,
  signIn: async () => ({ error: "Login er ikke sat op." }),
  signOut: noop,
  refreshSeller: noop,
  localMode: !authEnabled,
  sellers: [],
  setLocalSeller: () => {},
});

/** Supabase-fejl → dansk, uden at afsløre om kontoen findes. */
function danishAuthError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (!m) return "Login mislykkedes. Prøv igen.";
  if (m.includes("invalid login credentials")) return "Forkert e-mail eller adgangskode.";
  if (m.includes("email not confirmed")) return "E-mailen er ikke bekræftet endnu. Kontakt din administrator.";
  if (m.includes("rate limit") || m.includes("too many")) return "For mange forsøg. Vent et øjeblik, og prøv igen.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Ingen forbindelse til serveren. Tjek nettet, og prøv igen.";
  return "Login mislykkedes. Prøv igen.";
}

/** Nødsælger, hvis registret ikke kan svare — appen må aldrig stå uden identitet. */
function fallbackSeller(user: User): Seller {
  const email = (user.email ?? "").toLowerCase();
  return {
    id: user.id,
    initials: initialsOf(email || user.id),
    name: email || "Ukendt bruger",
    email: email || undefined,
    role: isManagerEmail(email) ? "leder" : "saelger",
    active: true,
    createdAt: user.created_at ?? new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState<boolean>(!authEnabled);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);

  const userId = session?.user?.id ?? null;

  /* --- Supabase-sessionen ------------------------------------------------ */
  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  /* --- Sælgerlisten (til vælgeren og til ledelsesoverblikket) ------------ */
  useEffect(() => {
    let cancelled = false;
    listSellers()
      .then((list) => {
        if (!cancelled) setSellers(list);
      })
      .catch(() => {
        /* registret må ikke kunne blokere appen */
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /* --- Identiteten: bruger → Seller -------------------------------------- */
  useEffect(() => {
    if (!authEnabled) return;
    const user = session?.user ?? null;

    if (!user) {
      setSeller(null);
      setActiveSeller(null);
      return;
    }

    let cancelled = false;
    resolveSeller(user)
      .then((s) => {
        if (cancelled) return;
        setSeller(s);
        setActiveSeller(s);
      })
      .catch(() => {
        if (cancelled) return;
        const s = fallbackSeller(user);
        setSeller(s);
        setActiveSeller(s);
      });

    return () => {
      cancelled = true;
    };
    // session-objektet skifter ved hver token-fornyelse; kun bruger-id'et
    // skal udløse en ny opløsning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* --- Lokal tilstand: husk den valgte sælger ---------------------------- */
  useEffect(() => {
    if (authEnabled) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LOCAL_SELLER_KEY);
    } catch {
      stored = null;
    }
    if (!stored) return;
    const s = makeLocalSeller(stored);
    setSeller(s);
    setActiveSeller(s);
  }, []);

  const setLocalSeller = useCallback((next: Seller) => {
    try {
      localStorage.setItem(LOCAL_SELLER_KEY, next.initials);
    } catch {
      /* uden lager glemmer vi valget ved genindlæsning — det er acceptabelt */
    }
    setSeller(next);
    setActiveSeller(next);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: "Login er ikke sat op i denne bygning." };
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      return { error: error ? danishAuthError(error.message) : null };
    } catch (e) {
      return { error: danishAuthError(e instanceof Error ? e.message : undefined) };
    }
  }, []);

  const signOut = useCallback(async () => {
    clearSellerCache();
    setSeller(null);
    setActiveSeller(null);
    if (!authEnabled) {
      try {
        localStorage.removeItem(LOCAL_SELLER_KEY);
      } catch {
        /* ligegyldigt */
      }
      return;
    }
    try {
      await supabase?.auth.signOut();
    } catch {
      /* selv en fejlet log-ud skal efterlade UI'et logget ud */
    }
  }, []);

  const refreshSeller = useCallback(async () => {
    clearSellerCache();
    const user = session?.user ?? null;
    if (user) {
      try {
        const s = await resolveSeller(user, { force: true });
        setSeller(s);
        setActiveSeller(s);
      } catch {
        const s = fallbackSeller(user);
        setSeller(s);
        setActiveSeller(s);
      }
    }
    try {
      setSellers(await listSellers());
    } catch {
      /* ligegyldigt */
    }
  }, [session]);

  // Vi er "loading", indtil sessionen er hentet — og indtil en fundet session
  // faktisk er oversat til en sælger.
  const loading = !ready || (Boolean(session) && !seller);

  const value = useMemo<AuthState>(
    () => ({
      authEnabled,
      loading,
      session,
      user: session?.user ?? null,
      seller,
      role: seller?.role ?? "saelger",
      isManager: seller?.role === "leder",
      signIn,
      signOut,
      refreshSeller,
      localMode: !authEnabled,
      sellers,
      setLocalSeller,
    }),
    [loading, session, seller, sellers, signIn, signOut, refreshSeller, setLocalSeller],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/* ============================================================== Adgangsspærring */

/**
 * Viser først indholdet, når vi ved hvem brugeren er:
 *   • med login   → login-skærm indtil der er en session
 *   • uden login  → sælgervælger i lokal tilstand
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session, seller, localMode } = useAuth();

  if (loading) return <Loading />;
  if (localMode) return seller ? <>{children}</> : <LocalModeGate />;
  if (!session) return <Login />;
  if (!seller) return <Loading />;
  return <>{children}</>;
}

function Loading() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="flex items-center gap-3 text-ink-mute">
        <span className="h-2 w-2 animate-think rounded-full bg-brand-500" />
        <span className="text-sm">Indlæser…</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Wordmark */

function Wordmark({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500 text-[15px] font-extrabold text-base shadow-glow">
        gl
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-bold text-ink">green light</div>
        <div className="eyebrow mt-0.5">{subtitle}</div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- Login-skærmen */

function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <div className="w-full max-w-[380px] animate-fade-up">
        <Wordmark subtitle="Internt værktøj" />

        <div className="panel mt-6 p-6 md:p-7">
          <h1 className="title-lg">Salgscoach</h1>
          <p className="body mt-1.5">
            Træn salget med en krævende salgsdirektør — rollespil, kvalificering, indvendinger og
            forberedelse.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="label">E-mail</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="fornavn@green-light.dk"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="label">Adgangskode</span>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-danger-600/40 bg-danger-900 px-4 py-2.5 text-sm text-danger-300"
              >
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
              {busy ? "Logger ind…" : "Log ind"}
            </button>
          </form>
        </div>

        <p className="body-mute mt-4 text-center text-xs">
          Adgang gives af green light. Mangler du login, så kontakt din salgsleder.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------- Lokal tilstand + vælger */

function LocalModeGate() {
  const { sellers, setLocalSeller } = useAuth();
  const [initials, setInitials] = useState("");

  // Registret hentes asynkront; indtil da viser vi seed-sælgerne, så vælgeren
  // aldrig står tom.
  const list = sellers.length ? sellers : seedSellers();

  const choose = (seller: Seller) => setLocalSeller(seller);

  const chooseTyped = (e: FormEvent) => {
    e.preventDefault();
    const key = initials.trim().toUpperCase();
    if (!key) return;
    setLocalSeller(makeLocalSeller(key));
  };

  return (
    <div className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <div className="w-full max-w-[520px] animate-fade-up">
        <Wordmark subtitle="Internt værktøj" />

        <div className="panel mt-6 p-6 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="title-lg">Salgscoach</h1>
            <span className="chip-warn">Lokal tilstand</span>
          </div>

          <p className="body mt-2">
            Appen kører uden login, fordi der ikke er forbindelse til green lights brugerstyring.
            Alt hvad du laver, bliver <strong className="font-semibold text-ink">kun</strong> i
            denne browser — intet deles med holdet, og intet kan hentes frem på en anden computer.
          </p>

          <div className="mt-6">
            <div className="eyebrow">Hvem træner?</div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {list.map((s) => {
                const avatar = sellerAvatar(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => choose(s)}
                    className="panel-quiet flex items-center gap-3 p-3 text-left transition-colors hover:border-brand-700"
                  >
                    <span className={`${avatar.className} h-9 w-9`}>{avatar.initials}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {s.initials}
                      </span>
                      <span className="block truncate text-2xs text-ink-mute">
                        {s.name !== s.initials ? s.name : "Sælger"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={chooseTyped} className="mt-6 flex items-end gap-2">
            <label className="block flex-1 space-y-1.5">
              <span className="label">Andre initialer</span>
              <input
                className="input"
                value={initials}
                onChange={(e) => setInitials(e.target.value)}
                placeholder="Fx PBN"
                maxLength={4}
              />
            </label>
            <button type="submit" className="btn-outline" disabled={!initials.trim()}>
              Fortsæt
            </button>
          </form>
        </div>

        <p className="body-mute mt-4 text-center text-xs">
          Skal historikken følge dig på tværs af computere, skal Salgscoachen sættes op med green
          lights login.
        </p>
      </div>
    </div>
  );
}
