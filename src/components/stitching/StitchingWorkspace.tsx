"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SetuHomeLink } from "@/components/SetuHomeLink";
import { CoverPreview } from "@/components/stitching/CoverPreview";
import { ExhibitIndexCard } from "@/components/stitching/ExhibitIndexCard";
import { FindingsList } from "@/components/stitching/FindingsList";
import { PacketReadinessCard } from "@/components/stitching/PacketReadinessCard";
import { SectionsList } from "@/components/stitching/SectionsList";
import type { AssembledPetition } from "@/lib/types";

export function StitchingWorkspace(props: {
  clientId: string;
  clientName: string;
  petitionType: string;
  packet: AssembledPetition;
}) {
  const router = useRouter();
  const [packet, setPacket] = useState(props.packet);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isMarkingFiled, setIsMarkingFiled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const blockingFindings = packet.findings.filter((finding) => finding.severity === "blocking");

  async function previewPacket() {
    setIsPreviewing(true);
    setErrorMessage(null);
    try {
      const windowRef = window.open(`/api/clients/${props.clientId}/packet/preview`, "_blank", "noopener,noreferrer");
      if (!windowRef) {
        throw new Error("Allow pop-ups to preview the packet PDF.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to preview the packet.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function generatePacket() {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/clients/${props.clientId}/packet`, { method: "POST" });
      const payload = (await response.json()) as { packet?: AssembledPetition; error?: string };
      if (!response.ok || !payload.packet) {
        throw new Error(payload.error || "Unable to generate the filable packet.");
      }
      setPacket(payload.packet);
      window.open(`/api/clients/${props.clientId}/packet/download`, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to generate the filable packet.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function markFiled() {
    setIsMarkingFiled(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/clients/${props.clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "filed",
          filedAt: new Date().toISOString(),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to mark the client as filed.");
      }
      router.push(`/clients/${props.clientId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to mark the client as filed.");
    } finally {
      setIsMarkingFiled(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-3 py-4 xl:px-4">
      <div className="mx-auto max-w-[1540px]">
        <header className="setu-topbar rounded-[18px] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="setu-brand-block">
              <div className="flex flex-wrap items-center gap-4">
                <SetuHomeLink />
                <span className="setu-scope-chip">
                  <span className="setu-scope-dot" />
                  <span>{props.clientName} · Stitching</span>
                </span>
              </div>
              <div className="space-y-1">
                <p className="setu-brand-tagline">
                  Assemble the final packet, audit cross-references, and export the filable PDF.
                </p>
                <p className="setu-brand-meta">
                  {packet.totalPages} pages · {packet.exhibitIndex.length} exhibits · {packet.findings.length} findings
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/clients/${props.clientId}/synthesis`}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
              >
                Back to synthesis
              </Link>
              <button
                type="button"
                onClick={() => void previewPacket()}
                disabled={isPreviewing}
                className="rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)] disabled:opacity-40"
              >
                {isPreviewing ? "Previewing…" : "Preview full PDF"}
              </button>
              <button
                type="button"
                onClick={() => void generatePacket()}
                disabled={isGenerating || blockingFindings.length > 0}
                title={
                  blockingFindings.length
                    ? "Resolve blocking findings before generating the packet."
                    : undefined
                }
                className="setu-primary-button inline-flex items-center rounded-[8px] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                {isGenerating ? "Generating…" : "Generate filable packet"}
              </button>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <main className="space-y-5">
            <PacketReadinessCard packet={packet} />
            {errorMessage ? (
              <div className="rounded-[16px] border border-[var(--state-danger)]/20 bg-[var(--state-danger-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-danger)]">
                {errorMessage}
              </div>
            ) : null}
            <SectionsList sections={packet.sections} />
            <FindingsList findings={packet.findings} />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
              <p className="text-[12px] leading-6 text-[var(--muted)]">
                Use Mark as filed only after the attorney has downloaded the packet and actually filed the case.
              </p>
              <button
                type="button"
                onClick={() => void markFiled()}
                disabled={isMarkingFiled || packet.status !== "ready"}
                className="rounded-[10px] border border-[var(--state-success)]/20 bg-[var(--state-success-soft)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--state-success)] disabled:opacity-40"
              >
                {isMarkingFiled ? "Marking…" : "Mark as filed"}
              </button>
            </div>
          </main>

          <aside className="space-y-4">
            <CoverPreview
              candidateName={props.clientName}
              petitionType={props.petitionType}
              batesStart={packet.batesRange.start}
            />
            <ExhibitIndexCard entries={packet.exhibitIndex} />
          </aside>
        </div>
      </div>
    </div>
  );
}
