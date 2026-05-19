"use client";

export function NarrativeSpineCard(props: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Narrative spine
      </p>
      <textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        rows={7}
        className="mt-3 w-full rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)] px-4 py-3 text-[12px] leading-6 text-[var(--foreground)] outline-none"
      />
    </section>
  );
}
