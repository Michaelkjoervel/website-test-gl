import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthProvider";
import { loadCloudPricing, type CloudPricingStatus } from "../lib/pricingCloud";
import { getPricingSource, type PricingSource } from "../lib/pricingConfig";

interface PricingState {
  source: PricingSource;
  status: CloudPricingStatus | null;
  // Bumper når konfigurationen ændres, så sider kan gen-beregne.
  version: number;
  reload: () => Promise<void>;
}

const PricingContext = createContext<PricingState>({
  source: "placeholder",
  status: null,
  version: 0,
  reload: async () => {},
});

/**
 * Indlæser det fortrolige prisgrundlag fra Supabase, når brugeren er logget
 * ind – FØR resten af appen renderes, så alle beregninger bruger de rigtige
 * priser fra første visning. Uden login bruges placeholder-priserne.
 */
export function PricingProvider({ children }: { children: ReactNode }) {
  const { authEnabled, loading: authLoading, session } = useAuth();
  const [ready, setReady] = useState(!authEnabled);
  const [status, setStatus] = useState<CloudPricingStatus | null>(null);
  const [version, setVersion] = useState(0);

  const reload = async () => {
    const s = await loadCloudPricing();
    setStatus(s);
    setVersion((v) => v + 1);
  };

  useEffect(() => {
    let cancelled = false;
    if (!authEnabled) {
      setReady(true);
      return;
    }
    if (authLoading) return;
    if (!session) {
      // Ikke logget ind: vis login-skærmen uden at vente på prisdata.
      setReady(true);
      return;
    }
    setReady(false);
    loadCloudPricing().then((s) => {
      if (cancelled) return;
      setStatus(s);
      setVersion((v) => v + 1);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [authEnabled, authLoading, session]);

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-ink-mute text-sm">
        Henter prisgrundlag…
      </div>
    );
  }

  return (
    <PricingContext.Provider
      value={{ source: getPricingSource(), status, version, reload }}
    >
      {children}
    </PricingContext.Provider>
  );
}

export function usePricing(): PricingState {
  return useContext(PricingContext);
}
