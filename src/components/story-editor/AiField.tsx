"use client";

export interface AiFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onRandomize: () => void | Promise<void>;
  busy?: boolean;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
}

export function AiField({
  label,
  value,
  onChange,
  onRandomize,
  busy = false,
  multiline = false,
  rows = 3,
  placeholder,
  hint,
  disabled = false,
}: AiFieldProps) {
  const Input = multiline ? "textarea" : "input";
  return (
    <label className="block text-xs text-zinc-400">
      <span className="mb-1 flex items-center justify-between gap-2">
        <span>{label}</span>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={(e) => {
            e.preventDefault();
            void onRandomize();
          }}
          title="KI: neuer Zufalls-Vorschlag für dieses Feld"
          className="shrink-0 rounded-md border border-violet-800/60 bg-violet-950/40 px-2 py-0.5 text-[10px] font-medium text-violet-200 disabled:opacity-40"
        >
          {busy ? "…" : "🎲 KI"}
        </button>
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={multiline ? rows : undefined}
        placeholder={placeholder}
        disabled={disabled || busy}
        className="mt-0.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 disabled:opacity-60"
      />
      {hint ? <span className="mt-1 block text-[10px] text-zinc-600">{hint}</span> : null}
    </label>
  );
}
