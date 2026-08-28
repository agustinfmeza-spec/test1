type Tone = "neutral" | "info" | "warning" | "success" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted-fg border-border",
  info: "bg-info-bg text-info border-transparent",
  warning: "bg-warning-bg text-warning border-transparent",
  success: "bg-success-bg text-success border-transparent",
  danger: "bg-danger-bg text-danger border-transparent",
};

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}
