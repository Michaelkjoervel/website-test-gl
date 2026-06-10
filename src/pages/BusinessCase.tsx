// =============================================================================
// BusinessCase – kundevendt forretningscase / ROI-præsentation
// -----------------------------------------------------------------------------
// Fuldskærmsside (uden for AppShell) som en sælger kan vise kunden direkte på
// skærmen. Tager et eksisterende estimat og forvandler tallene til en
// overbevisende historie: årlig besparelse, tilbagebetalingstid, akkumuleret
// cashflow med break-even-punkt, før/efter-energi og CO₂ omsat til genkendelige
// størrelser. Al matematik ligger i lib/businessCase.ts; her er kun præsentation
// og animation. Ingen eksterne afhængigheder – animationer er CSS + rAF og
// respekterer prefers-reduced-motion.
// =============================================================================

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { storage } from "../lib/storage";
import {
  buildBusinessCaseInput,
  buildDemoEstimate,
  computeBusinessCase,
  formatPayback,
  type BusinessCaseResult,
} from "../lib/businessCase";
import { pricingConfig } from "../lib/pricingConfig";
import { dkkInt, num, pct } from "../lib/format";

const da1 = (n: number) =>
  n.toLocaleString("da-DK", { maximumFractionDigits: 1 });
const intFmt = (n: number) => num.format(Math.round(n));
const kwhFmt = (n: number) => `${intFmt(n)} kWh`;

// ---------------------------------------------------------------------------
// Hooks: reduced-motion, scroll-reveal og tæller-optælling
// ---------------------------------------------------------------------------
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(m.matches);
    handler();
    m.addEventListener?.("change", handler);
    return () => m.removeEventListener?.("change", handler);
  }, []);
  return reduced;
}

function useReveal<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, shown };
}

function useCountUp(target: number, active: boolean, duration = 1200) {
  const reduced = useReducedMotion();
  const [val, setVal] = useState(0);
  const valRef = useRef(0);
  useEffect(() => {
    valRef.current = val;
  });
  useEffect(() => {
    if (!active) return;
    if (reduced || duration <= 0) {
      setVal(target);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const from = valRef.current;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      setVal(from + (target - from) * ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, reduced, duration]);
  if (!active) return reduced ? target : 0;
  return val;
}

// ---------------------------------------------------------------------------
// Side
// ---------------------------------------------------------------------------
export function BusinessCase() {
  const { id } = useParams<{ id: string }>();
  const isDemo = id === "demo";

  const est = useMemo(() => {
    if (isDemo) return buildDemoEstimate();
    return id ? storage.getEstimate(id) ?? null : null;
  }, [id, isDemo]);

  const input = useMemo(
    () => (est ? buildBusinessCaseInput(est) : null),
    [est],
  );

  const [escalationPct, setEscalationPct] = useState(
    pricingConfig.businessCase.electricityPriceEscalationPct,
  );

  const result = useMemo(
    () => (input ? computeBusinessCase(input, { escalationPct }) : null),
    [input, escalationPct],
  );

  if (!est || !input || !result) {
    return (
      <Shell title="Forretningscase">
        <div className="max-w-lg mx-auto card p-8 text-center">
          <h2 className="text-xl font-bold text-ink">Estimatet blev ikke fundet</h2>
          <p className="text-ink-mute mt-2 text-sm">
            Forretningscasen bygges oven på et gemt estimat.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link to="/historik" className="btn-outline">
              Til historik
            </Link>
            <Link to="/forretningscase/demo" className="btn-primary">
              Se demo
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Forretningscase" est={est} isDemo={isDemo}>
      {result.hasData ? (
        <CaseBody
          result={result}
          escalationPct={escalationPct}
          onEscalation={setEscalationPct}
          projectName={est.projectName}
          customerName={est.customerName}
        />
      ) : (
        <NoSavingsState estId={est.id} />
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Layout-skal med fuldskærms top-bar (skjules ved print)
// ---------------------------------------------------------------------------
function Shell({
  title,
  est,
  isDemo,
  children,
}: {
  title: string;
  est?: { id: string; projectName: string };
  isDemo?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-soft">
      <header className="bc-chrome sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-surface-line">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold text-xs shadow-glow shrink-0">
              gl
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-ink-mute">
                green light · {title}
              </div>
              <div className="font-bold text-ink text-sm truncate">
                {est?.projectName ?? "—"}
                {isDemo && (
                  <span className="ml-2 chip bg-amber-100 text-amber-800 align-middle">
                    Demo
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="btn-outline" onClick={() => window.print()}>
              <PrinterIcon /> Print / PDF
            </button>
            <Link
              to={est ? `/estimat/${est.id}` : "/historik"}
              className="btn-ghost"
            >
              Tilbage
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-6 md:py-10">
        {children}
      </main>
      <footer className="bc-chrome max-w-[1100px] mx-auto px-4 md:px-8 pb-10 pt-2 text-[11px] text-ink-mute">
        Vejledende forretningscase baseret på de indtastede oplysninger og green
        lights interne beregningsgrundlag. Ikke et bindende tilbud. Energi- og
        CO₂-tal er estimater; faktisk besparelse afhænger af drift, brændetid og
        elpris.
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selve casen
// ---------------------------------------------------------------------------
function CaseBody({
  result,
  escalationPct,
  onEscalation,
  projectName,
  customerName,
}: {
  result: BusinessCaseResult;
  escalationPct: number;
  onEscalation: (v: number) => void;
  projectName: string;
  customerName: string;
}) {
  const hero = useReveal<HTMLDivElement>();
  const stats = useReveal<HTMLDivElement>();
  const horizon = result.horizonYears;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Hero */}
      <div
        ref={hero.ref}
        className={`bc-hero relative overflow-hidden rounded-[28px] px-6 md:px-12 py-10 md:py-14 text-white ${
          hero.shown ? "bc-in" : "bc-pre"
        }`}
      >
        <div className="relative z-10">
          <div className="text-[12px] md:text-sm uppercase tracking-[0.18em] text-white/80">
            Forretningscase · {customerName || "Kunde"}
          </div>
          <h1 className="mt-3 text-3xl md:text-5xl font-extrabold leading-tight max-w-3xl">
            {projectName || "Belysningsprojekt"}
          </h1>
          <div className="mt-7 md:mt-9">
            <div className="text-white/80 text-sm uppercase tracking-wider">
              Forventet besparelse
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <HeroNumber value={result.firstYearTotalSavingsKr} active={hero.shown} />
              <span className="text-xl md:text-2xl font-semibold text-white/85 mb-1 md:mb-2">
                om året
              </span>
            </div>
            <div className="mt-2 text-white/85 text-sm md:text-base">
              Det svarer til{" "}
              <strong className="text-white">
                {dkkInt(result.horizonGrossSavings)}
              </strong>{" "}
              sparet over {horizon} år.
            </div>
          </div>
        </div>
        <CaseGlow />
      </div>

      {/* Nøgletal */}
      <div ref={stats.ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Investering"
          value={result.investment}
          format={dkkInt}
          active={stats.shown}
          icon={<WalletIcon />}
        />
        <PaybackCard result={result} active={stats.shown} />
        <StatCard
          label={`Nettogevinst · ${horizon} år`}
          value={result.horizonNetSavings}
          format={dkkInt}
          active={stats.shown}
          tone="primary"
          icon={<TrendIcon />}
        />
        <StatCard
          label={`Afkast · ${horizon} år`}
          value={result.roiPct}
          format={(n) => `${intFmt(n)}%`}
          active={stats.shown}
          icon={<SparkIcon />}
        />
      </div>

      {/* Cashflow + følsomhed */}
      <div className="card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h2 className="text-lg font-bold text-ink">Tilbagebetaling over tid</h2>
            <p className="text-sm text-ink-mute mt-0.5">
              Akkumuleret nettoresultat. Hvor kurven krydser nul, har anlægget
              tjent sig hjem.
            </p>
          </div>
          <div className="chip bg-brand-50 text-brand-800">
            Break-even: {formatPayback(result.paybackYears)}
          </div>
        </div>
        <CashflowChart result={result} />
        <SensitivityControl
          escalationPct={escalationPct}
          onEscalation={onEscalation}
          result={result}
        />
      </div>

      {/* Energi før/efter */}
      <EnergySection result={result} />

      {/* CO₂ */}
      <Co2Section result={result} />

      {/* Antagelser */}
      <AssumptionsStrip result={result} />
    </div>
  );
}

function HeroNumber({ value, active }: { value: number; active: boolean }) {
  const v = useCountUp(value, active, 1400);
  return (
    <div className="text-5xl md:text-7xl font-extrabold tracking-tight tabular-nums">
      {dkkInt(v)}
    </div>
  );
}

function CaseGlow() {
  return (
    <>
      <div
        className="pointer-events-none absolute -right-16 -top-24 w-[420px] h-[420px] rounded-full opacity-40 bc-glow"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,255,255,0.55), transparent)",
        }}
      />
      <div
        className="pointer-events-none absolute right-10 bottom-[-120px] w-[320px] h-[320px] rounded-full opacity-30 bc-glow"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,255,255,0.4), transparent)",
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Nøgletals-kort
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  format,
  active,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  active: boolean;
  tone?: "neutral" | "primary";
  icon?: ReactNode;
}) {
  const v = useCountUp(value, active);
  const primary = tone === "primary";
  return (
    <div
      className={`rounded-2xl border p-5 transition-shadow ${
        primary
          ? "bg-brand-500 text-white border-brand-500 shadow-card"
          : "bg-white border-surface-line shadow-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`text-[11px] uppercase tracking-wider ${
            primary ? "text-white/80" : "text-ink-mute"
          }`}
        >
          {label}
        </div>
        <span className={primary ? "text-white/80" : "text-brand-500"}>
          {icon}
        </span>
      </div>
      <div
        className={`mt-2 text-2xl md:text-[28px] font-bold tabular-nums ${
          primary ? "text-white" : "text-ink"
        }`}
      >
        {format(v)}
      </div>
    </div>
  );
}

function PaybackCard({
  result,
  active,
}: {
  result: BusinessCaseResult;
  active: boolean;
}) {
  const years = result.paybackYears;
  const v = useCountUp(years ?? 0, active, 1300);
  return (
    <div className="rounded-2xl border border-surface-line bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-ink-mute">
          Tilbagebetalingstid
        </div>
        <span className="text-brand-500">
          <ClockIcon />
        </span>
      </div>
      {years === null ? (
        <div className="mt-2 text-lg font-bold text-ink">Uden for perioden</div>
      ) : (
        <>
          <div className="mt-2 text-2xl md:text-[28px] font-bold text-ink tabular-nums">
            {da1(v)} år
          </div>
          <div className="text-xs text-ink-mute mt-0.5">
            ≈ {formatPayback(years)}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cashflow-diagram (inline SVG, tegner sig selv)
// ---------------------------------------------------------------------------
function CashflowChart({ result }: { result: BusinessCaseResult }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  const reduced = useReducedMotion();
  const series = result.series;
  const horizon = result.horizonYears;

  const W = 760;
  const H = 360;
  const padL = 56;
  const padR = 20;
  const padT = 24;
  const padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const nets = series.map((s) => s.netPosition);
  const maxV = Math.max(0, ...nets);
  const minV = Math.min(0, ...nets);
  const range = maxV - minV || 1;

  const x = (year: number) => padL + (year / horizon) * plotW;
  const y = (v: number) => padT + ((maxV - v) / range) * plotH;
  const zeroY = y(0);

  const linePath = series
    .map((s, i) => `${i === 0 ? "M" : "L"} ${x(s.year).toFixed(1)} ${y(s.netPosition).toFixed(1)}`)
    .join(" ");

  // Areal mellem kurve og nul-linjen (klippes i grøn over / rød under).
  const areaPath =
    `M ${x(0).toFixed(1)} ${zeroY.toFixed(1)} ` +
    series
      .map((s) => `L ${x(s.year).toFixed(1)} ${y(s.netPosition).toFixed(1)}`)
      .join(" ") +
    ` L ${x(horizon).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const be = result.breakEvenYear;
  const animate = shown && !reduced;

  // Y-akse referencer: top (max) og bund (-investering)
  const yTicks = [
    { v: maxV, label: dkkInt(maxV) },
    { v: 0, label: "0" },
    { v: minV, label: dkkInt(minV) },
  ];
  const xTicks = Array.from({ length: horizon + 1 }, (_, i) => i).filter(
    (i) => i === 0 || i === horizon || i % Math.ceil(horizon / 5) === 0,
  );

  return (
    <div ref={ref} className="mt-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Akkumuleret nettoresultat over tid"
      >
        <defs>
          <clipPath id="bc-clip-pos">
            <rect x="0" y="0" width={W} height={zeroY} />
          </clipPath>
          <clipPath id="bc-clip-neg">
            <rect x="0" y={zeroY} width={W} height={H - zeroY} />
          </clipPath>
          <linearGradient id="bc-pos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9FC34A" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#9FC34A" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Y-grid + labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(t.v)}
              y2={y(t.v)}
              stroke={t.v === 0 ? "#6B7466" : "#E5EBDD"}
              strokeWidth={t.v === 0 ? 1.5 : 1}
              strokeDasharray={t.v === 0 ? "4 4" : undefined}
            />
            <text
              x={padL - 8}
              y={y(t.v) + 4}
              textAnchor="end"
              className="fill-ink-mute"
              fontSize="11"
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* X labels */}
        {xTicks.map((yr) => (
          <text
            key={yr}
            x={x(yr)}
            y={H - 14}
            textAnchor="middle"
            className="fill-ink-mute"
            fontSize="11"
          >
            År {yr}
          </text>
        ))}

        {/* Areal */}
        <path
          d={areaPath}
          fill="url(#bc-pos)"
          clipPath="url(#bc-clip-pos)"
          style={{
            opacity: shown ? 1 : 0,
            transition: "opacity .8s ease .2s",
          }}
        />
        <path
          d={areaPath}
          fill="#E2574C"
          fillOpacity="0.1"
          clipPath="url(#bc-clip-neg)"
          style={{
            opacity: shown ? 1 : 0,
            transition: "opacity .8s ease .2s",
          }}
        />

        {/* Kurve – tegner sig selv */}
        <path
          d={linePath}
          fill="none"
          stroke="#65802A"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: animate ? 0 : reduced ? 0 : 1,
            transition: "stroke-dashoffset 1.5s ease",
          }}
        />

        {/* Break-even markør */}
        {be !== null && be <= horizon && (
          <g
            style={{
              opacity: shown ? 1 : 0,
              transition: "opacity .5s ease 1.25s",
            }}
          >
            <line
              x1={x(be)}
              x2={x(be)}
              y1={padT}
              y2={zeroY}
              stroke="#84A538"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <circle cx={x(be)} cy={zeroY} r="6" fill="#65802A" />
            <circle cx={x(be)} cy={zeroY} r="11" fill="#65802A" fillOpacity="0.18" />
            <g transform={`translate(${Math.min(x(be), W - padR - 132)}, ${padT})`}>
              <rect
                x="0"
                y="0"
                width="132"
                height="34"
                rx="8"
                fill="#0F1A0A"
                fillOpacity="0.92"
              />
              <text x="10" y="14" fontSize="10" className="fill-white" opacity="0.75">
                Tjent hjem
              </text>
              <text x="10" y="27" fontSize="12.5" fontWeight="700" className="fill-white">
                {formatPayback(be)}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Følsomhed (el-prisstigning)
// ---------------------------------------------------------------------------
function SensitivityControl({
  escalationPct,
  onEscalation,
  result,
}: {
  escalationPct: number;
  onEscalation: (v: number) => void;
  result: BusinessCaseResult;
}) {
  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center rounded-2xl bg-surface-soft border border-surface-line p-4 md:p-5">
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="bc-esc">
            Forventet årlig el-prisstigning
          </label>
          <span className="text-sm font-bold text-ink tabular-nums">
            {da1(escalationPct)}% / år
          </span>
        </div>
        <input
          id="bc-esc"
          type="range"
          min={0}
          max={8}
          step={0.5}
          value={escalationPct}
          onChange={(e) => onEscalation(Number(e.target.value))}
          className="brand-range mt-3"
        />
        <p className="text-xs text-ink-mute mt-2">
          Træk for at se hvordan en stigende elpris påvirker casen. Stigningen
          gælder energibesparelsen.
        </p>
      </div>
      <div className="md:border-l md:border-surface-line md:pl-5 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <span className="text-ink-mute">Tilbagebetaling</span>
        <span className="font-semibold text-ink text-right tabular-nums">
          {result.paybackYears === null ? "—" : `${da1(result.paybackYears)} år`}
        </span>
        <span className="text-ink-mute">Gevinst {result.horizonYears} år</span>
        <span className="font-semibold text-ink text-right tabular-nums">
          {dkkInt(result.horizonNetSavings)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Energi før/efter
// ---------------------------------------------------------------------------
function EnergySection({ result }: { result: BusinessCaseResult }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  const maxKwh = Math.max(result.currentAnnualKwh, result.newAnnualKwh, 1);
  const curH = (result.currentAnnualKwh / maxKwh) * 100;
  const newH = (result.newAnnualKwh / maxKwh) * 100;

  return (
    <div ref={ref} className="card p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-ink">Energiforbrug · før og efter</h2>
          <p className="text-sm text-ink-mute mt-0.5">
            Årligt elforbrug med den nye løsning sammenlignet med i dag.
          </p>
        </div>
        <span className="chip bg-brand-500 text-white text-sm">
          −{pct(result.savedPct, 0)} forbrug
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 items-end">
        {/* Søjler */}
        <div className="flex items-end justify-center gap-8 h-56">
          <Bar
            label="Nu"
            heightPct={shown ? curH : 0}
            valueLabel={kwhFmt(result.currentAnnualKwh)}
            color="#C7CFBE"
          />
          <Bar
            label="Ny løsning"
            heightPct={shown ? newH : 0}
            valueLabel={kwhFmt(result.newAnnualKwh)}
            color="#9FC34A"
            delay={150}
          />
        </div>

        {/* Tal */}
        <div className="grid grid-cols-2 gap-4">
          <MiniStat
            label="Sparet pr. år"
            value={result.annualKwhSaved}
            format={kwhFmt}
            active={shown}
          />
          <MiniStat
            label="Sparet pr. år"
            value={result.annualEnergySavingsKr}
            format={dkkInt}
            active={shown}
            tone="primary"
          />
          <MiniStat
            label="Svarer til husstande"
            value={result.householdsEquivalent}
            format={(n) => `${da1(n)} stk.`}
            active={shown}
            sub="årligt elforbrug"
          />
          <MiniStat
            label="Forbrug reduceret"
            value={result.savedPct * 100}
            format={(n) => `${intFmt(n)}%`}
            active={shown}
          />
        </div>
      </div>
    </div>
  );
}

function Bar({
  label,
  heightPct,
  valueLabel,
  color,
  delay = 0,
}: {
  label: string;
  heightPct: number;
  valueLabel: string;
  color: string;
  delay?: number;
}) {
  return (
    <div className="flex flex-col items-center h-full justify-end">
      <div className="text-xs font-semibold text-ink mb-2 tabular-nums">
        {valueLabel}
      </div>
      <div
        className="w-16 md:w-20 rounded-t-xl"
        style={{
          height: `${heightPct}%`,
          minHeight: 4,
          background: color,
          transition: `height 1.1s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
        }}
      />
      <div className="text-xs text-ink-mute mt-2">{label}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  format,
  active,
  tone = "neutral",
  sub,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  active: boolean;
  tone?: "neutral" | "primary";
  sub?: string;
}) {
  const v = useCountUp(value, active);
  return (
    <div
      className={`rounded-xl px-4 py-3 border ${
        tone === "primary"
          ? "bg-brand-50 border-brand-100"
          : "bg-surface-soft border-surface-line"
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-ink-mute">
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-bold tabular-nums ${
          tone === "primary" ? "text-brand-800" : "text-ink"
        }`}
      >
        {format(v)}
      </div>
      {sub && <div className="text-[11px] text-ink-mute">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CO₂
// ---------------------------------------------------------------------------
function Co2Section({ result }: { result: BusinessCaseResult }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  const co2 = result.co2;
  const tonsHorizon = co2.horizonKg / 1000;

  return (
    <div ref={ref} className="card p-6 md:p-8 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 md:gap-10 items-center">
        <div>
          <div className="flex items-center gap-2 text-brand-700">
            <LeafIcon />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Klimaaftryk
            </span>
          </div>
          <div className="mt-3">
            <Co2Big value={co2.annualKg} active={shown} />
            <div className="text-sm text-ink-mute mt-1">
              CO₂ sparet pr. år
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-50 text-brand-800 px-3 py-2 text-sm">
            <strong>{da1(tonsHorizon)} ton</strong> over {result.horizonYears} år
          </div>
          <p className="text-[11px] text-ink-mute mt-3">
            Beregnet med {da1(co2.factorKgPerKwh * 1000)} g CO₂/kWh (dansk el,
            konfigurerbar).
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <EquivCard
            value={co2.trees}
            active={shown}
            label="træer plantet"
            sub="årligt CO₂-optag"
            icon={<TreeIcon />}
          />
          <EquivCard
            value={co2.cars}
            active={shown}
            label="biler taget af vejen"
            sub="i et år"
            icon={<CarIcon />}
            decimals
          />
          <EquivCard
            value={co2.flights}
            active={shown}
            label="flyrejser"
            sub="CPH–London t/r"
            icon={<PlaneIcon />}
          />
          <EquivCard
            value={result.householdsEquivalent}
            active={shown}
            label="husstande"
            sub="årligt elforbrug"
            icon={<HouseIcon />}
            decimals
          />
        </div>
      </div>
    </div>
  );
}

function Co2Big({ value, active }: { value: number; active: boolean }) {
  const v = useCountUp(value, active, 1300);
  return (
    <div className="text-4xl md:text-5xl font-extrabold text-ink tabular-nums">
      {intFmt(v)}{" "}
      <span className="text-2xl md:text-3xl text-ink-mute font-bold">kg</span>
    </div>
  );
}

function EquivCard({
  value,
  active,
  label,
  sub,
  icon,
  decimals,
}: {
  value: number;
  active: boolean;
  label: string;
  sub: string;
  icon: ReactNode;
  decimals?: boolean;
}) {
  const v = useCountUp(value, active, 1300);
  const display = decimals ? da1(v) : intFmt(v);
  return (
    <div className="rounded-2xl border border-surface-line bg-surface-soft p-4 flex flex-col items-center text-center">
      <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold text-ink tabular-nums">{display}</div>
      <div className="text-xs font-medium text-ink-soft leading-tight">{label}</div>
      <div className="text-[11px] text-ink-mute">{sub}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Antagelser
// ---------------------------------------------------------------------------
function AssumptionsStrip({ result }: { result: BusinessCaseResult }) {
  const items: [string, string][] = [
    ["Elpris", `${da1(result.electricityPrice)} kr/kWh`],
    ["El-prisstigning", `${da1(result.escalationPct)}% / år`],
    ["Betragtningsperiode", `${result.horizonYears} år`],
    ["CO₂-faktor", `${da1(result.co2.factorKgPerKwh * 1000)} g/kWh`],
  ];
  return (
    <div className="rounded-2xl border border-dashed border-surface-line bg-white/60 px-5 py-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-2">
        Forudsætninger
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        {items.map(([k, v]) => (
          <div key={k} className="text-sm">
            <span className="text-ink-mute">{k}: </span>
            <span className="font-semibold text-ink">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoSavingsState({ estId }: { estId: string }) {
  return (
    <div className="max-w-xl mx-auto card p-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center mx-auto">
        <LeafIcon />
      </div>
      <h2 className="text-xl font-bold text-ink mt-4">
        Manglende grundlag for en forretningscase
      </h2>
      <p className="text-ink-mute mt-2 text-sm">
        For at beregne tilbagebetalingstid og besparelse skal estimatet have en
        energibesparelse (før/efter). Udfyld energitrinnet på estimatet, så
        bygges casen automatisk.
      </p>
      <div className="mt-5 flex items-center justify-center gap-3">
        <Link to={`/estimat/${estId}`} className="btn-outline">
          Til estimatet
        </Link>
        <Link to="/forretningscase/demo" className="btn-primary">
          Se en demo
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ikoner
// ---------------------------------------------------------------------------
function PrinterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M6 14h12v7H6v-7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3M3 7h17a1 1 0 0 1 1 1v3m0 0h-4a2 2 0 0 0 0 4h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function TrendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 17l6-6 4 4 8-8M21 7v5m0-5h-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3v4M12 17v4M5 12H1M23 12h-4M6 6l-2-2M20 20l-2-2M6 18l-2 2M20 4l-2 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function LeafIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 21c0-9 7-15 16-15 0 9-6 15-15 15-.5 0-1 0-1 0zM5 21c1-4 3-7 7-9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function TreeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2l5 7h-3l4 6h-4v3h-4v-3H6l4-6H7l5-7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 21v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function CarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 13l2-5a3 3 0 0 1 2.8-2h8.4A3 3 0 0 1 19 8l2 5M3 13h18M3 13v4h2m16-4v4h-2M6 17a1.5 1.5 0 1 0 3 0M15 17a1.5 1.5 0 1 0 3 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function PlaneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 3l1 7-7 4v2l7-1 1 5-2 1v1l3-1 3 1v-1l-2-1 1-5 7 1v-2l-7-4 1-7-2-1-1 6-2-1-1-4-1 1z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function HouseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 11l8-6 8 6M6 10v9h12v-9M10 19v-5h4v5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
