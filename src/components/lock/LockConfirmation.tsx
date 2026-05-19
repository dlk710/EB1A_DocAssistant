"use client";

export function LockConfirmation(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-[var(--border-primary)]"
      />
      <span className="text-[12px] leading-6 text-[var(--foreground)]">
        I&apos;ve reviewed the criteria mix and exhibit numbering. I understand that locking sets
        the case theory and unlocking later will flag dependent drafts as out-of-date.
      </span>
    </label>
  );
}
