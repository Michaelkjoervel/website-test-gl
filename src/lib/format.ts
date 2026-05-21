export const dkk = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

export const dkkInt = (n: number) => dkk.format(Math.round(n));

export const num = new Intl.NumberFormat("da-DK", {
  maximumFractionDigits: 0,
});

export const pct = (n: number, decimals = 1) =>
  `${(n * 100).toFixed(decimals)}%`;

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("da-DK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
