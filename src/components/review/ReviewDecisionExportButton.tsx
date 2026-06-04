"use client";

interface ReviewDecisionExportButtonProps {
  fileName: string;
  payload: Record<string, unknown>;
}

export function ReviewDecisionExportButton({
  fileName,
  payload,
}: ReviewDecisionExportButtonProps) {
  function downloadDecisionLog() {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={downloadDecisionLog}
      className="inline-flex items-center justify-center rounded-[8px] border border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] px-4 py-2 text-[11px] font-semibold text-white"
    >
      Download decision log
    </button>
  );
}
