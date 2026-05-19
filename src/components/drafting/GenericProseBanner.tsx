"use client";

export function GenericProseBanner(props: { message: string | null | undefined }) {
  if (!props.message) {
    return null;
  }

  return (
    <div className="rounded-[16px] border border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-warning)]">
      {props.message}
    </div>
  );
}
