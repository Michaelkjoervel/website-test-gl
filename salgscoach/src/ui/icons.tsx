// =============================================================================
// ui/icons · Ét sæt streg-ikoner
// -----------------------------------------------------------------------------
// Bevidst tynde, ens og neutrale. Ikoner må aldrig blive det, man lægger mærke
// til i en samtale — de skal kun hjælpe med at finde vej.
// =============================================================================

import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function Base({ children, ...p }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
      aria-hidden="true"
      {...p}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Home: (p: P) => (
    <Base {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.8V20h14V9.8" />
    </Base>
  ),
  Mic: (p: P) => (
    <Base {...p}>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3.5" />
    </Base>
  ),
  MicOff: (p: P) => (
    <Base {...p}>
      <path d="M4 4l16 16" />
      <path d="M9 5.2A3 3 0 0 1 15 5.5v5.2" />
      <path d="M15 15.2a3 3 0 0 1-6-2.2V9" />
      <path d="M5.5 11.5A6.5 6.5 0 0 0 15.6 17" />
      <path d="M12 18v3.5" />
    </Base>
  ),
  Play: (p: P) => (
    <Base {...p}>
      <path d="M7 4.5 19 12 7 19.5z" />
    </Base>
  ),
  Pause: (p: P) => (
    <Base {...p}>
      <path d="M9 4.5v15M15 4.5v15" />
    </Base>
  ),
  Stop: (p: P) => (
    <Base {...p}>
      <rect x="5.5" y="5.5" width="13" height="13" rx="2.5" />
    </Base>
  ),
  Chart: (p: P) => (
    <Base {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Base>
  ),
  User: (p: P) => (
    <Base {...p}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Base>
  ),
  Users: (p: P) => (
    <Base {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16.2 5.2a3.2 3.2 0 0 1 0 5.9" />
      <path d="M17.6 14.4a6.2 6.2 0 0 1 3.6 5.1" />
    </Base>
  ),
  Doc: (p: P) => (
    <Base {...p}>
      <path d="M6 2.8h7.5L19 8.3V21H6z" />
      <path d="M13.2 3v5.4H19" />
      <path d="M9 13h6M9 16.5h4" />
    </Base>
  ),
  History: (p: P) => (
    <Base {...p}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.2 4.5V9h4.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Base>
  ),
  Book: (p: P) => (
    <Base {...p}>
      <path d="M4 4.5A2 2 0 0 1 6 3h13v15.5H6A2 2 0 0 0 4 20.5z" />
      <path d="M4 18.5A2 2 0 0 1 6 17h13" />
    </Base>
  ),
  Spark: (p: P) => (
    <Base {...p}>
      <path d="M12 3.2 13.8 9l5.8 1.8-5.8 1.8L12 18.4l-1.8-5.8L4.4 10.8 10.2 9z" />
    </Base>
  ),
  Arrow: (p: P) => (
    <Base {...p}>
      <path d="M5 12h13M13 6.5 18.5 12 13 17.5" />
    </Base>
  ),
  Back: (p: P) => (
    <Base {...p}>
      <path d="M19 12H6M11 6.5 5.5 12 11 17.5" />
    </Base>
  ),
  Check: (p: P) => (
    <Base {...p}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </Base>
  ),
  X: (p: P) => (
    <Base {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  ),
  Warn: (p: P) => (
    <Base {...p}>
      <path d="M12 3.8 21.5 20H2.5z" />
      <path d="M12 9.8v4.4M12 17.2v.1" />
    </Base>
  ),
  Phone: (p: P) => (
    <Base {...p}>
      <path d="M5 3.8h3.6l1.6 4-2 1.5a12 12 0 0 0 5.6 5.6l1.5-2 4 1.6V18a2.4 2.4 0 0 1-2.6 2.4C9.6 19.8 4.2 14.4 3.6 6.4A2.4 2.4 0 0 1 5 3.8z" />
    </Base>
  ),
  Target: (p: P) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    </Base>
  ),
  Shield: (p: P) => (
    <Base {...p}>
      <path d="M12 3.2 19.5 6v6c0 4.4-3 7.6-7.5 9-4.5-1.4-7.5-4.6-7.5-9V6z" />
    </Base>
  ),
  Handshake: (p: P) => (
    <Base {...p}>
      <path d="M3 12.5 7 8.5l3.2 2.6 2.4-2.1 4 3.4" />
      <path d="M13.5 15.5 15 17M11 17l1.4 1.4M16.6 12.4 21 9" />
      <path d="M3 9.2 7 5.4l3.4 1.2 3.6-1.2L21 9" />
    </Base>
  ),
  Lightning: (p: P) => (
    <Base {...p}>
      <path d="M13.5 2.5 5 13.5h6L10.5 21.5 19 10.5h-6z" />
    </Base>
  ),
  Search: (p: P) => (
    <Base {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8 20.5 20.5" />
    </Base>
  ),
  Upload: (p: P) => (
    <Base {...p}>
      <path d="M12 16V4.5M7.5 9 12 4.5 16.5 9" />
      <path d="M4.5 15.5v3A2 2 0 0 0 6.5 20.5h11a2 2 0 0 0 2-2v-3" />
    </Base>
  ),
  Menu: (p: P) => (
    <Base {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Base>
  ),
  Logout: (p: P) => (
    <Base {...p}>
      <path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14" />
      <path d="M17 8.5 20.5 12 17 15.5M20 12h-9" />
    </Base>
  ),
  Repeat: (p: P) => (
    <Base {...p}>
      <path d="M4 9.5A5 5 0 0 1 9 4.5h9" />
      <path d="M15 1.8 18.2 4.5 15 7.2" />
      <path d="M20 14.5a5 5 0 0 1-5 5H6" />
      <path d="M9 22.2 5.8 19.5 9 16.8" />
    </Base>
  ),
};

export type IconName = keyof typeof Icon;
