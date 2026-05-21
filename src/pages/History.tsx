import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { storage } from "../lib/storage";
import { ConfidenceBadge } from "../components/Confidence";
import { dkkInt, formatDate, num } from "../lib/format";
import type { CustomerEstimate, EstimateStatus } from "../lib/types";

const STATUSES: (EstimateStatus | "Alle")[] = [
  "Alle",
  "Kladde",
  "Sendt",
  "Vundet",
  "Tabt",
  "Opdateret til faktisk tilbud",
];

export function History() {
  const [items, setItems] = useState<CustomerEstimate[]>([]);
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("Alle");
  const [q, setQ] = useState("");

  useEffect(() => {
    setItems(storage.listEstimates());
  }, []);

  const filtered = useMemo(() => {
    return items
      .filter((e) => (filter === "Alle" ? true : e.status === filter))
      .filter((e) => {
        const s = q.trim().toLowerCase();
        if (!s) return true;
        return (
          e.projectName.toLowerCase().includes(s) ||
          e.customerName.toLowerCase().includes(s)
        );
      });
  }, [items, filter, q]);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <input
          className="input md:w-72"
          placeholder="Søg på kunde eller projekt..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`chip border ${
                filter === s
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white text-ink-soft border-surface-line hover:border-brand-300"
              }`}
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-ink-mute">
          {filtered.length} estimater
        </div>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-ink-mute">
            Ingen estimater matcher dine filtre.{" "}
            <Link to="/nyt-estimat" className="text-brand-700 underline">
              Opret et nyt
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-soft text-ink-mute text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3">Projekt / Kunde</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">Dato</th>
                <th className="text-right px-5 py-3 hidden sm:table-cell">
                  Antal
                </th>
                <th className="text-right px-5 py-3">Estimat</th>
                <th className="text-left px-5 py-3 hidden lg:table-cell">
                  Sikkerhed
                </th>
                <th className="text-left px-5 py-3">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-surface-line hover:bg-surface-soft"
                >
                  <td className="px-5 py-3">
                    <div className="font-semibold text-ink">
                      {e.projectName || "Uden navn"}
                    </div>
                    <div className="text-xs text-ink-mute">
                      {e.customerName}
                    </div>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell text-ink-mute">
                    {formatDate(e.createdAt)}
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell text-right text-ink">
                    {num.format(e.technical.luminaireCount)}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-ink">
                    {dkkInt(e.pricing.totalCost)}
                  </td>
                  <td className="px-5 py-3 hidden lg:table-cell">
                    <ConfidenceBadge confidence={e.confidence} />
                  </td>
                  <td className="px-5 py-3">
                    <span className="chip bg-surface-soft border border-surface-line text-ink-soft">
                      {e.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/estimat/${e.id}`}
                      className="text-brand-700 font-semibold hover:underline"
                    >
                      Åbn →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
