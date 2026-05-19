"use client";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  isSubmitting?: boolean;
  placeholder?: string;
}

export function ChatInput(props: ChatInputProps) {
  return (
    <div className="space-y-3">
      <textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled || props.isSubmitting}
        rows={4}
        className="w-full rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-3 text-[13px] leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] disabled:cursor-not-allowed disabled:bg-[var(--paper-secondary)]"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={props.onSubmit}
          disabled={props.disabled || props.isSubmitting || !props.value.trim()}
          className="setu-primary-button inline-flex items-center rounded-[10px] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {props.isSubmitting ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
