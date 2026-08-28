type Tone = "neutral" | "info" | "warning" | "success" | "danger";

const VALUE_TONE_CLASSES: Record<Tone, string> = {
  neutral: "text-foreground",
  info: "text-info",
  warning: "text-warning",
  success: "text-success",
  danger: "text-danger",
};

export function StatCard({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: Tone }) {
  return (
    <div className="flex flex-col gap-1 rounded border border-border bg-surface p-4">
      <span className="text-xs text-muted-fg">{label}</span>
      <span className={`text-2xl font-semibold ${VALUE_TONE_CLASSES[tone]}`}>{value}</span>
      {hint && <span className="text-[11px] text-muted-fg">{hint}</span>}
    </div>
  );
}
