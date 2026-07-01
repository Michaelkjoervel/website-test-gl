import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { storage } from "../lib/storage";
import { sampleHistorical } from "../lib/mockData";
import type { CustomerEstimate, HistoricalOffer } from "../lib/types";
import { dkkInt, formatDate, num } from "../lib/format";
import { ConfidenceBadge } from "../components/Confidence";

function maturityFor(n: number) {
  if (n < 10) return { label: "Startfase", desc: "under 10 projekter", score: 1 };
  if (n < 30)
    return { label: "Begyndende grundlag", desc: "10-30 projekter", score: 2 };
  if (n < 100)
    return { label: "Brugbar historik", desc: "30-100 projekter", score: 3 };
  return { label: "Stærkt datagrundlag", desc: "100+ projekter", score: 4 };
}

export function Dashboard() {
  const [estimates, setEstimates] = useState<CustomerEstimate[]>([]);
  const [historical, setHistorical] = useState<HistoricalOffer[]>([]);

  useEffect(() => {
    // Seed med eksempler første gang appen åbnes
    if (storage.listHistorical().length === 0) {
      storage.saveHistorical(sampleHistorical);
    }
    setEstimates(storage.listEstimates());
    setHistorical(storage.listHistorical());
  }, []);

  const stats = useMemo(() => {
    const count = estimates.length;
    const totalEst =
      estimates.reduce((s, e) => s + e.pricing.totalCost, 0) || 0;
    const avg = count > 0 ? totalEst / count : 0;
    const won = estimates.filter(
      (e) =>
        e.status === "Vundet" ||
        e.actual?.finalStatus === "Vundet" ||
        e.actual?.actualTotal,
    ).length;
    const lost = estimates.filter(
      (e) => e.status === "Tabt" || e.actual?.finalStatus === "Tabt",
    ).length;

    const withActual = estimates.filter((e) => e.actual?.actualTotal);
    const avgDelta =
      withActual.length === 0
        ? 0
        : withActual.reduce(
            (s, e) =>
              s +
              ((e.actual!.actualTotal! - e.pricing.totalCost) /
                e.pricing.totalCost) *
                100,
            0,
          ) / withActual.length;

    const luminaireTotal = estimates.reduce(
      (s, e) => s + e.pricing.pricePerLuminaire,
      0,
    );
    const avgPerLum =
      estimates.length > 0 ? luminaireTotal / estimates.length : 0;

    const datapoints = historical.length + withActual.length;
    return {
      count,
      avg,
      won,
      lost,
      avgDelta,
      avgPerLum,
      datapoints,
      maturity: maturityFor(datapoints),
    };
  }, [estimates, historical]);

  const recent = estimates.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Visualiseringsunivers – banner */}
      <div className="card p-5 md:p-6 bc-hero text-white flex flex-col md:flex-row md:items-center gap-4 overflow-hidden">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-white/70">Nyt · Visualisering</div>
          <h2 className="text-lg md:text-xl font-bold mt-0.5">Vis kunden løsningen – før den er sat op</h2>
          <p className="text-sm text-white/85 mt-1 max-w-2xl">
            Upload et billede af kundens lokale, vælg armaturer fra universet, og få en fotorealistisk
            før/efter-visualisering af, hvordan belysningen kommer til at se ud.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to="/univers" className="btn bg-white/15 text-white hover:bg-white/25 backdrop-blur">Universet</Link>
          <Link to="/ny-visualisering" className="btn bg-white text-brand-800 hover:bg-white/90 font-semibold">Ny visualisering →</Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard label="Estimater oprettet" value={num.format(stats.count)} />
        <KpiCard label="Gns. projektpris" value={dkkInt(stats.avg)} />
        <KpiCard
          label="Gns. afvigelse"
          value={
            stats.avgDelta === 0 ? "—" : `${stats.avgDelta.toFixed(1)}%`
          }
          tone={stats.avgDelta === 0 ? "neutral" : stats.avgDelta > 0 ? "warn" : "good"}
        />
        <KpiCard
          label="Vundet / Tabt"
          value={`${stats.won} / ${stats.lost}`}
        />
      </div>

      {/* Maturity + per-armatur */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="kpi-label">Datagrundlagets modenhed</div>
              <div className="mt-1 text-lg font-bold text-ink">
                {stats.maturity.label}
              </div>
              <div className="text-xs text-ink-mute">{stats.maturity.desc}</div>
            </div>
            <div className="text-xs text-ink-mute">
              {stats.datapoints} datapunkter
            </div>
          </div>
          <div className="flex gap-2 h-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`flex-1 rounded-full ${
                  i <= stats.maturity.score
                    ? "bg-brand-500"
                    : "bg-surface-line"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-ink-mute mt-3 leading-relaxed">
            Systemet bliver mere præcist, jo flere historiske tilbud og faktiske
            resultater der tilføjes. På sigt skal estimater ramme inden for
            5–10% af det reelle resultat.
          </p>
        </div>
        <div className="card p-5">
          <div className="kpi-label">Gns. pris pr. armatur</div>
          <div className="kpi-num mt-1">{dkkInt(stats.avgPerLum)}</div>
          <div className="text-xs text-ink-mute mt-1">
            Beregnet på tværs af dine estimater.
          </div>
          <Link
            to="/nyt-estimat"
            className="btn-primary mt-5 w-full justify-center"
          >
            Start nyt estimat
          </Link>
        </div>
      </div>

      {/* Recent */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-line">
          <div>
            <div className="kpi-label">Seneste estimater</div>
            <div className="text-sm text-ink-mute mt-0.5">
              {estimates.length === 0
                ? "Du har endnu ikke oprettet et estimat."
                : `${estimates.length} i alt`}
            </div>
          </div>
          <Link to="/historik" className="btn-ghost">
            Se alle →
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-surface-line">
            {recent.map((e) => (
              <li key={e.id}>
                <Link
                  to={`/estimat/${e.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-surface-soft transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink truncate">
                      {e.projectName || "Uden navn"}
                    </div>
                    <div className="text-xs text-ink-mute truncate">
                      {e.customerName} · {formatDate(e.createdAt)} ·{" "}
                      {num.format(e.technical.luminaireCount)} armaturer
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="font-bold text-ink">
                      {dkkInt(e.pricing.totalCost)}
                    </div>
                    <div className="text-xs text-ink-mute">
                      {e.status}
                    </div>
                  </div>
                  <ConfidenceBadge confidence={e.confidence} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const tones = {
    neutral: "text-ink",
    good: "text-brand-700",
    warn: "text-amber-600",
  };
  return (
    <div className="card p-4 md:p-5">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-num mt-1 ${tones[tone]}`}>{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-5 py-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center mb-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 4v16M4 12h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="font-semibold text-ink">Ingen estimater endnu</div>
      <div className="text-sm text-ink-mute mt-1 mb-4">
        Opret dit første estimat ude hos kunden.
      </div>
      <Link to="/nyt-estimat" className="btn-primary">
        Start nyt estimat
      </Link>
    </div>
  );
}
