import Link from "next/link";
import type { ChatMessageCitation } from "@/lib/types";

export function CitationChip(props: { citation: ChatMessageCitation }) {
  return (
    <Link
      href={`/api/documents/${props.citation.docId}/source?jobId=${encodeURIComponent(
        props.citation.workspaceId,
      )}`}
      target="_blank"
      className="inline-flex items-center rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-deep)] transition hover:opacity-85"
      title={props.citation.excerpt}
    >
      {props.citation.label}
    </Link>
  );
}
