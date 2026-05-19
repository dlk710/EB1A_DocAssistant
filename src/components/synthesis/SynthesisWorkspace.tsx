"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatDock } from "@/components/chat/ChatDock";
import { SetuHomeLink } from "@/components/SetuHomeLink";
import { GenericProseBanner } from "@/components/drafting/GenericProseBanner";
import { VersionCompareModal } from "@/components/drafting/VersionCompareModal";
import { ApprovedDraftsRail } from "@/components/synthesis/ApprovedDraftsRail";
import { SectionHelperCard } from "@/components/synthesis/SectionHelperCard";
import { SynthesisFactCheckBanner } from "@/components/synthesis/SynthesisFactCheckBanner";
import { SynthesisPane } from "@/components/synthesis/SynthesisPane";
import { SynthesisTabStrip } from "@/components/synthesis/SynthesisTabStrip";
import { SynthesisToolbar } from "@/components/synthesis/SynthesisToolbar";
import type { SynthesisDraft, SynthesisParagraph, SynthesisSectionKind, SynthesisVersion } from "@/lib/types";

interface ApprovedDraftReference {
  draftId: string;
  criterionCode: string;
  legalCode: string;
  criterionName: string;
  approvedVersion: number;
  excerpt: string;
  fullText: string;
}

interface TabEntry {
  kind: SynthesisSectionKind;
  label: string;
  status: "approved" | "in-progress" | "not-started" | "out-of-date";
  versionLabel: string;
}

function latestVersion(draft: SynthesisDraft | null) {
  return draft?.versions.at(-1) ?? null;
}

export function SynthesisWorkspace(props: {
  clientId: string;
  clientName: string;
  workspaceCount: number;
  initialKind: SynthesisSectionKind;
  drafts: Record<SynthesisSectionKind, SynthesisDraft | null>;
  approvedDrafts: ApprovedDraftReference[];
  tabs: TabEntry[];
  leadNarrative: string;
}) {
  const router = useRouter();
  const [activeKind, setActiveKind] = useState<SynthesisSectionKind>(props.initialKind);
  const [drafts, setDrafts] = useState<Record<SynthesisSectionKind, SynthesisDraft | null>>(props.drafts);
  const [selectedReferenceCode, setSelectedReferenceCode] = useState<string | null>(
    props.approvedDrafts[0]?.criterionCode ?? null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exemplarWarning, setExemplarWarning] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeDraft = drafts[activeKind];
  const currentVersion = useMemo(() => latestVersion(activeDraft), [activeDraft]);
  const previousVersion = useMemo(
    () => (activeDraft && activeDraft.versions.length > 1 ? activeDraft.versions[activeDraft.versions.length - 2] : null),
    [activeDraft],
  );
  const visibleParagraphs: SynthesisParagraph[] = useMemo(
    () => currentVersion?.paragraphs ?? [],
    [currentVersion],
  );
  const selectedReference = props.approvedDrafts.find((entry) => entry.criterionCode === selectedReferenceCode) ?? null;
  const allApproved = (drafts["statement-of-eligibility"]?.latestApprovedVersion !== null) &&
    (drafts["final-merits-determination"]?.latestApprovedVersion !== null);
  const hasBlockingFactCheck = visibleParagraphs.some((paragraph) => {
    if (paragraph.factCheckStatus === "uncited") {
      return true;
    }

    return (
      paragraph.factCheckStatus === "drift-detected" &&
      paragraph.factCheckNotes?.toLowerCase().includes("significant")
    );
  });
  const headerStatusLine = allApproved
    ? "Both sections approved"
    : currentVersion
      ? "Approval in progress"
      : "All criterion drafts approved · ready to begin synthesis";

  function draftLabel(kind: SynthesisSectionKind) {
    return kind === "statement-of-eligibility" ? "Statement of Eligibility" : "Final Merits Determination";
  }

  function updateParagraphText(paragraphId: string, text: string) {
    setDrafts((current) => {
      const draft = current[activeKind];
      if (!draft || !currentVersion) {
        return current;
      }
      return {
        ...current,
        [activeKind]: {
          ...draft,
          versions: draft.versions.map((version) =>
            version.version === currentVersion.version
              ? {
                  ...version,
                  paragraphs: version.paragraphs.map((paragraph) =>
                    paragraph.id === paragraphId ? { ...paragraph, text } : paragraph,
                  ),
                }
              : version,
          ),
        },
      };
    });
    setDirty(true);
  }

  useEffect(() => {
    if (!dirty || !currentVersion) {
      return;
    }
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        const response = await fetch(
          `/api/clients/${props.clientId}/synthesis/${activeKind}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              versionNumber: currentVersion.version,
              paragraphs: currentVersion.paragraphs,
              authorNotes: currentVersion.authorNotes,
              source: currentVersion.source === "ai" ? "ai-edited" : currentVersion.source,
              genericProseWarning: currentVersion.genericProseWarning ?? null,
              styleProfileId: currentVersion.styleProfileId ?? null,
              styleExemplarIds: currentVersion.styleExemplarIds ?? [],
            }),
          },
        );
        const payload = (await response.json()) as { draft?: SynthesisDraft; error?: string };
        if (!response.ok || !payload.draft) {
          throw new Error(payload.error || "Unable to auto-save this synthesis section.");
        }
        setDrafts((current) => ({ ...current, [activeKind]: payload.draft ?? null }));
        setDirty(false);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to auto-save this synthesis section.");
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [dirty, currentVersion, props.clientId, activeKind]);

  async function regenerateDraft() {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/clients/${props.clientId}/synthesis/${activeKind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as {
        draft?: SynthesisDraft;
        error?: string;
        exemplarWarning?: string | null;
      };
      if (!response.ok || !payload.draft) {
        throw new Error(payload.error || "Unable to regenerate this synthesis section.");
      }
      setDrafts((current) => ({ ...current, [activeKind]: payload.draft ?? null }));
      setDirty(false);
      setExemplarWarning(payload.exemplarWarning ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to regenerate this synthesis section.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function approveCurrentDraft() {
    if (!currentVersion) {
      return;
    }
    setIsApproving(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/clients/${props.clientId}/synthesis/${activeKind}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: currentVersion.version }),
      });
      const payload = (await response.json()) as { draft?: SynthesisDraft; error?: string };
      if (!response.ok || !payload.draft) {
        throw new Error(payload.error || "Unable to approve this synthesis section.");
      }
      setDrafts((current) => ({ ...current, [activeKind]: payload.draft ?? null }));
      setDirty(false);
      if (activeKind === "statement-of-eligibility") {
        setActiveKind("final-merits-determination");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to approve this synthesis section.");
    } finally {
      setIsApproving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-3 py-4 xl:px-4">
      <div className="mx-auto max-w-[1600px]">
        <header className="setu-topbar rounded-[18px] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="setu-brand-block">
              <div className="flex flex-wrap items-center gap-4">
                <SetuHomeLink />
                <span className="setu-scope-chip">
                  <span className="setu-scope-dot" />
                  <span>{props.clientName} · Synthesis</span>
                </span>
              </div>
              <div className="space-y-1">
                <p className="setu-brand-tagline">
                  Synthesize approved criterion arguments into the petition’s analytical bookends.
                </p>
                <p className="setu-brand-meta">
                  {draftLabel(activeKind)} · {currentVersion ? `v${currentVersion.version}` : "Not started"} · {headerStatusLine}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/clients/${props.clientId}/drafting`}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
              >
                Back to drafting
              </Link>
              {allApproved ? (
                <button
                  type="button"
                  onClick={() => router.push(`/clients/${props.clientId}/stitching`)}
                  className="setu-primary-button inline-flex items-center rounded-[8px] px-4 py-2 text-[11px] font-semibold text-white"
                >
                  Continue to Stitching
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <div className="mt-5 space-y-4">
          <SynthesisTabStrip
            activeKind={activeKind}
            tabs={props.tabs}
            onChange={(kind) => {
              setActiveKind(kind);
              setDirty(false);
            }}
          />
          {errorMessage ? (
            <div className="rounded-[16px] border border-[var(--state-danger)]/20 bg-[var(--state-danger-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-danger)]">
              {errorMessage}
            </div>
          ) : null}
          {exemplarWarning ? (
            <div className="rounded-[16px] border border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-warning)]">
              {exemplarWarning}
            </div>
          ) : null}
          <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
            <aside className="space-y-4">
              <ApprovedDraftsRail
                entries={props.approvedDrafts}
                selectedCriterionCode={selectedReferenceCode}
                onSelect={setSelectedReferenceCode}
              />
              <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Lead argument
                </p>
                <p className="mt-2 text-[12px] leading-6 text-[var(--muted)]">{props.leadNarrative}</p>
              </div>
              <SectionHelperCard kind={activeKind} />
            </aside>

            <main className="space-y-4">
              <SynthesisFactCheckBanner paragraphs={visibleParagraphs} />
              <GenericProseBanner message={currentVersion?.genericProseWarning ?? null} />
              <SynthesisPane
                paragraphs={visibleParagraphs}
                onChangeParagraph={updateParagraphText}
                referenceDraft={selectedReference}
              />
              <SynthesisToolbar
                versionNumbers={activeDraft?.versions.map((version) => version.version) ?? []}
                currentVersion={currentVersion?.version ?? null}
                isSaving={isSaving}
                isGenerating={isGenerating}
                isApproving={isApproving}
                approveDisabled={hasBlockingFactCheck}
                onCompare={() => setCompareOpen(true)}
                onRegenerate={() => void regenerateDraft()}
                onApprove={() => void approveCurrentDraft()}
              />
            </main>

            <aside>
              <ChatDock
                clientId={props.clientId}
                candidateName={props.clientName}
                workspaceCount={props.workspaceCount}
                variant="panel"
                initialMode="draft"
                draftEnabled
                synthesisKind={activeKind}
              />
            </aside>
          </div>
        </div>
      </div>
      <VersionCompareModal
        open={compareOpen}
        leftVersion={previousVersion as SynthesisVersion | null}
        rightVersion={currentVersion as SynthesisVersion | null}
        onClose={() => setCompareOpen(false)}
      />
    </div>
  );
}
