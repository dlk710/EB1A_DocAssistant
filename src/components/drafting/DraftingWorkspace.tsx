"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatDock } from "@/components/chat/ChatDock";
import { CriterionTabStrip } from "@/components/drafting/CriterionTabStrip";
import { DraftPane } from "@/components/drafting/DraftPane";
import { DraftToolbar } from "@/components/drafting/DraftToolbar";
import { FactCheckBanner } from "@/components/drafting/FactCheckBanner";
import { GenericProseBanner } from "@/components/drafting/GenericProseBanner";
import { Pinboard } from "@/components/drafting/Pinboard";
import { StrategyNotesCard } from "@/components/drafting/StrategyNotesCard";
import { VersionCompareModal } from "@/components/drafting/VersionCompareModal";
import { runGenericProseCheck } from "@/lib/draft-prose-check";
import type { CriterionDraft, DraftParagraph } from "@/lib/types";

interface CriterionTabView {
  criterionCode: string;
  legalCode: string;
  name: string;
  href: string;
  status: "approved" | "in-progress" | "not-started" | "out-of-date";
  versionLabel?: string | null;
  active?: boolean;
}

interface PinboardEntryView {
  documentId: string;
  workspaceId: string;
  exhibitLabel: string;
  title: string;
  fileName: string;
}

interface SuggestedDocument {
  id: string;
  title: string;
  fileName: string;
}

function latestVersion(draft: CriterionDraft | null) {
  return draft?.versions.at(-1) ?? null;
}

export function DraftingWorkspace(props: {
  clientId: string;
  clientName: string;
  criterionCode: string;
  criterionName: string;
  criterionLegalCode: string;
  tabs: CriterionTabView[];
  draft: CriterionDraft;
  pinboardEntries: PinboardEntryView[];
  suggestedDocuments: SuggestedDocument[];
  strategyRationale: string;
  narrativeSpine: string;
  anchorExhibits: string[];
}) {
  const [draft, setDraft] = useState<CriterionDraft>(props.draft);
  const [pinboardEntries, setPinboardEntries] = useState(props.pinboardEntries);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentVersion = useMemo(() => latestVersion(draft), [draft]);
  const previousVersion = useMemo(() => (draft.versions.length > 1 ? draft.versions[draft.versions.length - 2] : null), [draft]);
  const visibleParagraphs: DraftParagraph[] = useMemo(
    () => currentVersion?.paragraphs ?? [],
    [currentVersion],
  );

  function updateParagraphText(paragraphId: string, text: string) {
    setDraft((current) => ({
      ...current,
      versions: current.versions.map((version) =>
        version.version === currentVersion?.version
          ? {
              ...version,
              paragraphs: version.paragraphs.map((paragraph) =>
                paragraph.id === paragraphId ? { ...paragraph, text } : paragraph,
              ),
            }
          : version,
      ),
    }));
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
          `/api/clients/${props.clientId}/drafts/${props.criterionCode}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              versionNumber: currentVersion.version,
              paragraphs: currentVersion.paragraphs,
              authorNotes: currentVersion.authorNotes,
              source: currentVersion.source === "ai" ? "ai-edited" : currentVersion.source,
            }),
          },
        );
        const payload = (await response.json()) as { draft?: CriterionDraft; error?: string };
        if (!response.ok || !payload.draft) {
          throw new Error(payload.error || "Unable to auto-save this draft.");
        }
        setDraft(payload.draft);
        setDirty(false);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to auto-save this draft.");
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [dirty, currentVersion, props.clientId, props.criterionCode]);

  async function updatePinboard(action: { type: "reorder"; documentIds: string[] } | { type: "add"; documentId: string }) {
    const response = await fetch(
      `/api/clients/${props.clientId}/pinboards/${props.criterionCode}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body:
          action.type === "add"
            ? JSON.stringify({ action: "add", documentId: action.documentId })
            : JSON.stringify({ action: "reorder", documentIds: action.documentIds }),
      },
    );
    const payload = (await response.json()) as {
      pinboard?: { entries: Array<{ documentId: string; workspaceId: string; exhibitLabel: string }> };
      error?: string;
    };
    if (!response.ok || !payload.pinboard) {
      throw new Error(payload.error || "Unable to update the pinboard.");
    }

    setPinboardEntries((current) =>
      payload.pinboard!.entries.map((entry) => {
        const existing = current.find((candidate) => candidate.documentId === entry.documentId);
        const suggested = props.suggestedDocuments.find((candidate) => candidate.id === entry.documentId);
        return {
          documentId: entry.documentId,
          workspaceId: entry.workspaceId,
          exhibitLabel: entry.exhibitLabel,
          title: existing?.title || suggested?.title || entry.documentId,
          fileName: existing?.fileName || suggested?.fileName || entry.documentId,
        };
      }),
    );
  }

  async function regenerateDraft() {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/clients/${props.clientId}/drafts/${props.criterionCode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as { draft?: CriterionDraft; error?: string };
      if (!response.ok || !payload.draft) {
        throw new Error(payload.error || "Unable to regenerate this draft.");
      }
      setDraft(payload.draft);
      setDirty(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to regenerate this draft.");
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
      const response = await fetch(
        `/api/clients/${props.clientId}/drafts/${props.criterionCode}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: currentVersion.version,
          }),
        },
      );
      const payload = (await response.json()) as { draft?: CriterionDraft; error?: string };
      if (!response.ok || !payload.draft) {
        throw new Error(payload.error || "Unable to approve this draft.");
      }
      setDraft(payload.draft);
      setDirty(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to approve this draft.");
    } finally {
      setIsApproving(false);
    }
  }

  const proseWarning = useMemo(
    () => runGenericProseCheck(visibleParagraphs.map((paragraph) => ({ text: paragraph.text }))).message,
    [visibleParagraphs],
  );

  return (
    <div className="min-h-screen bg-[var(--background)] px-3 py-4 xl:px-4">
      <div className="mx-auto max-w-[1600px]">
        <header className="setu-topbar rounded-[18px] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="setu-brand-block">
              <div className="flex flex-wrap items-center gap-4">
                <span className="setu-wordmark" aria-label="setu">
                  <span className="setu-wordmark-letters">setu</span>
                  <span className="setu-wordmark-deck" aria-hidden="true" />
                </span>
                <span className="setu-scope-chip">
                  <span className="setu-scope-dot" />
                  <span>{props.clientName} · Drafting</span>
                </span>
              </div>
              <p className="setu-brand-tagline">
                Build the criterion argument with grounded exhibits, style exemplars, and Ask Setu Draft mode.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/clients/${props.clientId}`}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
              >
                Client home
              </Link>
              <Link
                href={`/settings/style-profiles`}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
              >
                Style profiles
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-5 space-y-4">
          <CriterionTabStrip tabs={props.tabs} />

          {errorMessage ? (
            <div className="rounded-[16px] border border-[var(--state-danger)]/20 bg-[var(--state-danger-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-danger)]">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <Pinboard
                entries={pinboardEntries}
                suggestedDocuments={props.suggestedDocuments}
                onAddDocument={(documentId) => void updatePinboard({ type: "add", documentId })}
                onMoveEntry={(documentId, direction) => {
                  const currentIndex = pinboardEntries.findIndex((entry) => entry.documentId === documentId);
                  if (currentIndex === -1) {
                    return;
                  }
                  const nextIndex = currentIndex + direction;
                  if (nextIndex < 0 || nextIndex >= pinboardEntries.length) {
                    return;
                  }
                  const nextEntries = [...pinboardEntries];
                  const [moved] = nextEntries.splice(currentIndex, 1);
                  nextEntries.splice(nextIndex, 0, moved);
                  setPinboardEntries(nextEntries);
                  void updatePinboard({
                    type: "reorder",
                    documentIds: nextEntries.map((entry) => entry.documentId),
                  });
                }}
              />
              <StrategyNotesCard
                legalCode={props.criterionLegalCode}
                criterionName={props.criterionName}
                rationale={props.strategyRationale}
                narrativeSpine={props.narrativeSpine}
                anchorExhibits={props.anchorExhibits}
              />
            </div>

            <div className="space-y-4">
              <DraftToolbar
                versionNumbers={draft.versions.map((version) => version.version)}
                currentVersion={currentVersion?.version ?? null}
                isSaving={isSaving}
                isGenerating={isGenerating}
                isApproving={isApproving}
                onOpenCompare={() => setCompareOpen(true)}
                onRegenerate={() => void regenerateDraft()}
                onApprove={() => void approveCurrentDraft()}
              />
              <FactCheckBanner paragraphs={visibleParagraphs} />
              <GenericProseBanner message={proseWarning} />
              <DraftPane paragraphs={visibleParagraphs} onChangeParagraph={updateParagraphText} />
            </div>

            <div>
              <ChatDock
                clientId={props.clientId}
                candidateName={props.clientName}
                workspaceCount={1}
                variant="panel"
                initialMode="draft"
                criterionCode={props.criterionCode}
                draftEnabled
              />
            </div>
          </div>
        </div>
      </div>

      <VersionCompareModal
        open={compareOpen}
        leftVersion={previousVersion ?? currentVersion}
        rightVersion={currentVersion}
        onClose={() => setCompareOpen(false)}
      />
    </div>
  );
}
