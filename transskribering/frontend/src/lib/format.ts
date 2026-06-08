export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h} t ${m} min`;
  if (m > 0) return `${m} min ${s} sek`;
  return `${s} sek`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("da-DK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const STATUS_LABELS: Record<string, string> = {
  queued: "I kø",
  analyzing: "Analyserer",
  preparing: "Klargør",
  chunking: "Opdeler",
  transcribing: "Transskriberer",
  merging: "Samler tekst",
  completed: "Færdig",
  failed: "Fejl",
  cancelled: "Annulleret",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
