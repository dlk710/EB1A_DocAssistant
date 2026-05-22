"use client";

export function GapNote(props: { notes: string[] }) {
  if (!props.notes.length) {
    return null;
  }

  return (
    <div className="rounded-[16px] border border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-warning)]">
      <p className="font-semibold">Gap note</p>
      <ul className="mt-2 space-y-1">
        {props.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
