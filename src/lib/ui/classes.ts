/** Shared compact UI class strings (taste-skill / redesign preserve). */
export const ui = {
  panel:
    "rounded-lg border border-surface-border/80 bg-surface-raised/85 backdrop-blur-sm",
  panelInset: "rounded-lg border border-surface-border/60 bg-surface/60",
  btn:
    "inline-flex items-center justify-center rounded-lg border border-surface-border bg-surface-raised/90 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-accent/35 hover:text-zinc-50 active:scale-[0.98] disabled:opacity-40",
  btnAccent:
    "inline-flex items-center justify-center rounded-lg border border-accent/45 bg-accent/15 px-2.5 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/22 active:scale-[0.98] disabled:opacity-40",
  btnPrimary:
    "inline-flex items-center justify-center rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-accent/90 active:scale-[0.98] disabled:opacity-40",
  btnDanger:
    "inline-flex items-center justify-center rounded-lg border border-red-500/35 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-300 transition hover:border-red-400/50 active:scale-[0.98] disabled:opacity-40",
  chip:
    "inline-flex items-center rounded-md border border-surface-border/70 bg-surface/50 px-2 py-0.5 text-[10px] font-medium text-zinc-400",
  label: "text-[10px] font-medium uppercase tracking-wide text-zinc-500",
  input:
    "w-full rounded-lg border border-surface-border bg-surface-raised/90 px-2.5 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-accent/50",
  sectionGap: "space-y-1.5",
  dock: "safe-bottom border-t border-surface-border/80 bg-surface/95 backdrop-blur-md",
} as const;
