"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatDock } from "@/components/chat/ChatDock";
import { SetuHomeLink } from "@/components/SetuHomeLink";
import { CriterionTabStrip } from "@/components/drafting/CriterionTabStrip";
import { DraftToolbar } from "@/components/drafting/DraftToolbar";
import { FactCheckBanner } from "@/components/drafting/FactCheckBanner";
import { GenericProseBanner } from "@/components/drafting/GenericProseBanner";
import { Pinboard } from "@/components/drafting/Pinboard";
import { StrategyNotesCard } from "@/components/drafting/StrategyNotesCard";
import { SubsectionPane } from "@/components/drafting/SubsectionPane";
import { SubsectionTree } from "@/components/drafting/SubsectionTree";
import { VersionCompareModal } from "@/components/drafting/VersionCompareModal";
import { runGenericProseCheck } from "@/lib/draft-prose-check";
import { findSubsection, listSubsections, updateSubsection } from "@/lib/subsection-drafts";
import type { CriterionDraft, DraftParagraph, EndorsementQuote } from "@/lib/types";

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

function firstFocusableSubsection(draft: CriterionDraft) {
  const subsections = listSubsections(draft.root);
  return (
    subsections.find((node) => node.level === 2)?.id ??
    subsections.find((node) => node.level === 1)?.id ??
    draft.root.id
  );
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
  quoteSuggestionsBySubsection: Record<string, EndorsementQuote[]>;
}) {
  const [draft, setDraft] = useState<CriterionDraft>(props.draft);
  const [pinboardEntries, setPinboardEntries] = useState(props.pinboardEntries);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [focusedSubsectionId, setFocusedSubsectionId] = useState(() => firstFocusableSubsection(props.draft));
  const [criterionKind, setCriterionKind] = useState<CriterionDraft["kind"]>(props.draft.kind);
  const [standardCriterionInvoked, setStandardCriterionInvoked] = useState(
    props.draft.standardCriterionInvoked ?? "",
  );
  const [comparableEvidenceRationale, setComparableEvidenceRationale] = useState(
    props.draft.comparableEvidenceRationale ?? "",
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSubsectionId = useMemo(
    () => findSubsection(draft.root, focusedSubsectionId)?.id ?? firstFocusableSubsection(draft),
    [draft, focusedSubsectionId],
  );
  const currentSubsection = useMemo(
    () => findSubsection(draft.root, activeSubsectionId),
    [activeSubsectionId, draft.root],
  );
  const currentVersion = useMemo(() => currentSubsection?.versions.at(-1) ?? null, [currentSubsection]);
  const previousVersion = useMemo(
    () =>
      currentSubsection && currentSubsection.versions.length > 1
        ? currentSubsection.versions[currentSubsection.versions.length - 2]
        : null,
    [currentSubsection],
  );
  const visibleParagraphs: DraftParagraph[] = useMemo(
    () => currentSubsection?.paragraphs ?? [],
    [currentSubsection],
  );
  const allApproved = props.tabs.every((tab) =>
    tab.criterionCode === props.criterionCode ? draft.status === "approved" : tab.status === "approved",
  );
  const quoteSuggestions = currentSubsection
    ? props.quoteSuggestionsBySubsection[currentSubsection.id] ?? []
    : [];

  function updateCurrentSubsection(
    updater: (subsection: NonNullable<typeof currentSubsection>) => NonNullable<typeof currentSubsection>,
  ) {
    if (!currentSubsection) {
      return;
    }

    setDraft((current) => ({
      ...current,
      kind: criterionKind,
      standardCriterionInvoked,
      comparableEvidenceRationale,
      root: updateSubsection(current.root, currentSubsection.id, (subsection) => updater(subsection)),
    }));
    setDirty(true);
  }

  function updateParagraphText(paragraphId: string, text: string) {
    updateCurrentSubsection((subsection) => ({
      ...subsection,
      paragraphs: subsection.paragraphs.map((paragraph) =>
        paragraph.id === paragraphId ? { ...paragraph, text } : paragraph,
      ),
    }));
  }

  function addParagraph() {
    updateCurrentSubsection((subsection) => ({
      ...subsection,
      paragraphs: [
        ...subsection.paragraphs,
        {
          id: globalThis.crypto.randomUUID(),
          text: "",
          exhibitRefs: [],
          citations: [],
          factCheckStatus: "pending",
        },
      ],
    }));
  }

  function acceptQuote(quote: EndorsementQuote) {
    updateCurrentSubsection((subsection) => ({
      ...subsection,
      endorsementQuotes: subsection.endorsementQuotes.some((entry) => entry.id === quote.id)
        ? subsection.endorsementQuotes
        : [...subsection.endorsementQuotes, quote],
      gapNotes: [],
    }));
  }

  function removeQuote(quoteId: string) {
    updateCurrentSubsection((subsection) => ({
      ...subsection,
      endorsementQuotes: subsection.endorsementQuotes.filter((quote) => quote.id !== quoteId),
    }));
  }

  useEffect(() => {
    if (!dirty || !currentSubsection) {
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
              subsectionId: currentSubsection.id,
              versionNumber: currentVersion?.version,
              paragraphs: currentSubsection.paragraphs,
              endorsementQuotes: currentSubsection.endorsementQuotes,
              source: currentVersion?.source === "ai" ? "ai-edited" : "manual",
              criterionKind,
              standardCriterionInvoked,
              comparableEvidenceRationale,
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
  }, [
    dirty,
    comparableEvidenceRationale,
    criterionKind,
    currentSubsection,
    currentVersion,
    props.clientId,
    props.criterionCode,
    standardCriterionInvoked,
  ]);

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
    if (!currentSubsection) {
      return;
    }
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/clients/${props.clientId}/drafts/${props.criterionCode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subsectionId: currentSubsection.id,
          criterionKind,
          standardCriterionInvoked,
          comparableEvidenceRationale,
        }),
      });
      const payload = (await response.json()) as { draft?: CriterionDraft; error?: string };
      if (!response.ok || !payload.draft) {
        throw new Error(payload.error || "Unable to regenerate this subsection.");
      }
      setDraft(payload.draft);
      setDirty(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to regenerate this subsection.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function approveCurrentDraft() {
    if (!currentSubsection) {
      return;
    }
    const version = currentSubsection.versions.at(-1)?.version;
    if (!version) {
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
            subsectionId: currentSubsection.id,
            version,
          }),
        },
      );
      const payload = (await response.json()) as { draft?: CriterionDraft; error?: string };
      if (!response.ok || !payload.draft) {
        throw new Error(payload.error || "Unable to approve this subsection.");
      }
      setDraft(payload.draft);
      setDirty(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to approve this subsection.");
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
      <div className="mx-auto max-w-[1680px]">
        <header className="setu-topbar rounded-[18px] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="setu-brand-block">
              <div className="flex flex-wrap items-center gap-4">
                <SetuHomeLink />
                <span className="setu-scope-chip">
                  <span className="setu-scope-dot" />
                  <span>{props.clientName} · Drafting</span>
                </span>
              </div>
              <p className="setu-brand-tagline">
                Build the criterion argument as a recursive tree with evidence-led subsections and verbatim endorsement quotes.
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
          <CriterionTabStrip
            tabs={props.tabs}
            completionCta={
              allApproved
                ? {
                    label: "Continue to synthesis",
                    href: `/clients/${props.clientId}/synthesis`,
                  }
                : null
            }
          />

          {errorMessage ? (
            <div className="rounded-[16px] border border-[var(--state-danger)]/20 bg-[var(--state-danger-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-danger)]">
              {errorMessage}
            </div>
          ) : null}

          <DraftToolbar
            versionNumbers={currentSubsection?.versions.map((version) => version.version) ?? []}
            currentVersion={currentSubsection?.versions.at(-1)?.version ?? null}
            isSaving={isSaving}
            isGenerating={isGenerating}
            isApproving={isApproving}
            onOpenCompare={() => setCompareOpen(true)}
            onRegenerate={() => void regenerateDraft()}
            onApprove={() => void approveCurrentDraft()}
          />

          <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
            <aside className="space-y-4">
              <SubsectionTree
                root={draft.root}
                activeSubsectionId={activeSubsectionId}
                onSelectSubsection={setFocusedSubsectionId}
              />
              <StrategyNotesCard
                legalCode={props.criterionLegalCode}
                criterionName={props.criterionName}
                rationale={props.strategyRationale}
                narrativeSpine={props.narrativeSpine}
                anchorExhibits={props.anchorExhibits}
              />
            </aside>

            <main className="space-y-4">
              <FactCheckBanner paragraphs={visibleParagraphs} />
              <GenericProseBanner message={proseWarning} />
              <SubsectionPane
                subsection={currentSubsection}
                quoteSuggestions={quoteSuggestions}
                onChangeParagraph={updateParagraphText}
                onAddParagraph={addParagraph}
                onAcceptQuote={acceptQuote}
                onRemoveQuote={removeQuote}
              />
            </main>

            <aside className="space-y-4">
              <section className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Criterion mode
                </p>
                <div className="mt-3 space-y-3">
                  <select
                    value={criterionKind}
                    onChange={(event) => {
                      setCriterionKind(event.target.value as CriterionDraft["kind"]);
                      setDirty(true);
                    }}
                    className="w-full rounded-[12px] border border-[var(--border-secondary)] bg-white px-3 py-2 text-[12px] text-[var(--foreground)]"
                  >
                    <option value="standard">Standard evidence</option>
                    <option value="comparable-evidence">Comparable evidence</option>
                  </select>
                  {criterionKind === "comparable-evidence" ? (
                    <div className="space-y-3">
                      <input
                        value={standardCriterionInvoked}
                        onChange={(event) => {
                          setStandardCriterionInvoked(event.target.value);
                          setDirty(true);
                        }}
                        placeholder="Standard criterion invoked"
                        className="w-full rounded-[12px] border border-[var(--border-secondary)] bg-white px-3 py-2 text-[12px] text-[var(--foreground)]"
                      />
                      <textarea
                        value={comparableEvidenceRationale}
                        onChange={(event) => {
                          setComparableEvidenceRationale(event.target.value);
                          setDirty(true);
                        }}
                        placeholder="Why the standard criterion does not naturally apply and why this evidence is comparable."
                        className="min-h-[120px] w-full rounded-[12px] border border-[var(--border-secondary)] bg-white px-3 py-2 text-[12px] leading-6 text-[var(--foreground)]"
                      />
                    </div>
                  ) : null}
                </div>
              </section>

              <Pinboard
                entries={pinboardEntries}
                suggestedDocuments={props.suggestedDocuments}
                onAddDocument={(documentId) => void updatePinboard({ type: "add", documentId })}
                onMoveEntry={(documentId: string, direction: -1 | 1) => {
                  const currentIndex = pinboardEntries.findIndex((entry) => entry.documentId === documentId);
                  if (currentIndex === -1) {
                    return;
                  }
                  const nextIndex = currentIndex + direction;
                  if (nextIndex < 0 || nextIndex >= pinboardEntries.length) {
                    return;
                  }
                  const nextEntries = [...pinboardEntries];
                  const [target] = nextEntries.splice(currentIndex, 1);
                  nextEntries.splice(nextIndex, 0, target);
                  void updatePinboard({
                    type: "reorder",
                    documentIds: nextEntries.map((entry) => entry.documentId),
                  });
                }}
              />

              <ChatDock
                clientId={props.clientId}
                candidateName={props.clientName}
                workspaceCount={1}
                variant="panel"
                initialMode="draft"
                criterionCode={props.criterionCode}
                focusedSubsectionId={currentSubsection?.id ?? null}
                focusedSubsectionTitle={currentSubsection?.title ?? null}
                focusedSubsectionSupportsClaim={currentSubsection?.supportsClaim ?? null}
                draftEnabled
              />
            </aside>
          </div>
        </div>

        <VersionCompareModal
          open={compareOpen}
          leftVersion={previousVersion}
          rightVersion={currentVersion}
          onClose={() => setCompareOpen(false)}
        />
      </div>
    </div>
  );
}
