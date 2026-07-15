import { useState, type ReactNode, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { supabase } from "../lib/supabase";

/**
 * Adgangsspærring. Er login slået fra (ingen Supabase-config), vises indholdet
 * uændret. Ellers kræves en aktiv session – ellers vises login-skærmen.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { authEnabled, loading, session } = useAuth();

  if (!authEnabled) return <>{children}</>;
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-ink-mute text-sm">Indlæser…</div>
    );
  }
  if (!session) return <Login />;
  return <>{children}</>;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message || "Login mislykkedes.");
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <form onSubmit={submit} className="card p-6 md:p-8 w-full max-w-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold shadow-glow">gl</div>
          <div>
            <div className="font-bold text-ink leading-tight">green light</div>
            <div className="text-[11px] text-ink-mute">Internt værktøj – log ind for at fortsætte</div>
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="label">E-mail</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Adgangskode</span>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5">{error}</div>}

        <button type="submit" className="btn-primary w-full justify-center py-3 disabled:opacity-50" disabled={busy}>
          {busy ? "Logger ind…" : "Log ind"}
        </button>
        <p className="text-[11px] text-ink-mute text-center">
          Adgang gives af green light. Kontakt din administrator, hvis du mangler login.
        </p>
      </form>
    </div>
  );
}
