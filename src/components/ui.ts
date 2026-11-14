// Shared Tailwind class recipes. Logical utilities (ms-, ps-, start-) keep layouts RTL-safe.

const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const btnPrimary = `${btn} bg-primary text-primary-foreground hover:bg-primary-hover`;
export const btnSecondary = `${btn} border border-border bg-surface text-foreground hover:bg-surface-muted`;
export const btnDanger = `${btn} bg-danger text-white hover:opacity-90`;
export const btnGhost = `${btn} text-primary hover:bg-surface-muted`;

export const card = "rounded-2xl border border-border bg-surface p-5 shadow-sm";

export const inputClass =
  "min-h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-base text-foreground placeholder:text-muted/70";

export const labelClass = "mb-1.5 block text-sm font-medium";

export const alertError =
  "rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger";

export const alertSuccess =
  "rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm text-success";

export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";
