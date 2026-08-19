// =============================================================================
// pages/VoiceCheck · Stemmediagnose
// -----------------------------------------------------------------------------
// Én knap, ét ærligt svar: kan serveren udstede en realtime-stemmesession hos
// OpenAI lige nu — og hvis ikke, hvad siger OpenAI helt præcist?
//
// Siden er ikke i menuen. Den findes til fejlsøgning (/#/stemmetest), så en
// samtale om "stemmen virker ikke" kan handle om en konkret fejlbesked i
// stedet for symptomer. Proben koster ikke noget: nøglen fra prøvesessionen
// bruges aldrig og videregives ikke.
// =============================================================================

import { useCallback, useState } from "react";
import { config } from "../config";
import { getAccessToken } from "../lib/supabase";
import { Icon } from "../ui/icons";
import { ErrorNote, Notice, PageHeader, Panel, Spinner } from "../ui/primitives";
import { realtimeSupported } from "../voice/realtime";
import { browserVoiceSupported } from "../voice/browserVoice";

interface ProbeResult {
  ok: boolean;
  status: number;
  model: string | null;
  api: string | null;
  variant: string | null;
  error: string | null;
}

export function VoiceCheck() {
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setProbe(null);
    setFailure(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${config.apiBase}/coach-session?probe=1`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json: { probe?: ProbeResult; error?: string } = await res.json();
      if (json.probe) setProbe(json.probe);
      else setFailure(json.error || `Serveren svarede ${res.status} uden et probe-resultat.`);
    } catch (e) {
      setFailure((e as Error).message || "Serveren kunne ikke nås.");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow="Fejlsøgning"
        title="Stemmediagnose"
        desc="Tester om serveren kan oprette en realtime-stemmesession hos OpenAI lige nu — og viser OpenAI's egentlige svar, hvis den ikke kan."
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" onClick={() => void run()} disabled={busy}>
            {busy ? <Spinner size={15} /> : <Icon.Mic width={16} height={16} />}
            {busy ? "Tester…" : "Kør diagnosen"}
          </button>
          <span className="text-xs text-ink-mute">Tager få sekunder. Starter ingen samtale.</span>
        </div>

        {failure && (
          <div className="mt-4">
            <ErrorNote>{failure}</ErrorNote>
          </div>
        )}

        {probe && (
          <div className="mt-5 space-y-3">
            {probe.ok ? (
              <Notice>
                <strong className="font-semibold text-ink">Realtime-stemmen virker.</strong>{" "}
                OpenAI udstedte en session på modellen <code>{probe.model}</code>
                {probe.variant ? <> (variant: {probe.variant})</> : null}. Melder en øvelse
                alligevel fejl, ligger problemet i selve forbindelsen fra din browser — sig til,
                og tag et skærmbillede af beskeden i øvelsen.
              </Notice>
            ) : (
              <Notice tone="warn">
                <strong className="font-semibold text-ink">
                  OpenAI afviste stemmesessionen ({probe.status}
                  {probe.model ? ` på ${probe.model}` : ""}).
                </strong>
                <div className="mt-1.5 break-words">{probe.error}</div>
                <div className="mt-2 text-xs text-ink-mute">
                  Send hele denne besked videre — den fortæller præcis, hvad der skal rettes.
                </div>
              </Notice>
            )}
          </div>
        )}

        <div className="divider mt-5 pt-4 text-xs text-ink-mute">
          Denne browser: realtime (WebRTC){" "}
          {realtimeSupported() ? "understøttes" : "understøttes IKKE"} · reservestemme
          (talegenkendelse) {browserVoiceSupported() ? "understøttes" : "understøttes IKKE"}.
        </div>
      </Panel>
    </div>
  );
}
