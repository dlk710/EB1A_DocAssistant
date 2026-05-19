"use client";

export function CoverPreview(props: {
  candidateName: string;
  petitionType: string;
  batesStart: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Cover preview
      </p>
      <div className="mt-3 rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-cream)] px-4 py-5">
        <p className="text-[12px] font-semibold text-[var(--foreground)]">{props.candidateName}</p>
        <p className="mt-1 text-[11px] text-[var(--muted)]">{props.petitionType}</p>
        <div className="mt-8 flex items-end justify-between text-[10px] text-[var(--muted)]">
          <span>setu</span>
          <span>{props.batesStart}</span>
        </div>
      </div>
    </div>
  );
}
