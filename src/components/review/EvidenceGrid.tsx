"use client";

import { useEffect, useRef, useState } from "react";
import { BulkActionBar } from "@/components/review/BulkActionBar";
import type {
  EvidenceGridFilters,
  EvidenceGridProps,
  GridMutation,
  QuickPeekPayload,
  SaveState,
} from "@/components/review/evidence-grid-types";
import { FilterBar } from "@/components/review/FilterBar";
import { GridHeader } from "@/components/review/GridHeader";
import { GridRow } from "@/components/review/GridRow";
import { GridToolbar } from "@/components/review/GridToolbar";
import { QuickPeekPanel } from "@/components/review/QuickPeekPanel";
import {
  deriveDocumentDisposition,
  setDocumentDisposition,
  upsertCriterionTag,
} from "@/lib/criterion-tags";
import type { EvidenceGridDocument } from "@/lib/evidence-query";

const DEFAULT_FILTERS: EvidenceGridFilters = {
  workspaceId: "",
  bundleId: "",
  criterionCode: "",
  disposition: "",
  aiUnsure: false,
  search: "",
};

function buildSearchHaystack(document: EvidenceGridDocument) {
  return [
    document.fileName,
    document.relativePath,
    document.summary?.title,
    document.summary?.shortSummary,
    document.summary?.detailedSummary,
    document.metadata?.preview,
    document.bundleName,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

export function EvidenceGrid({
  clientId,
  clientName,
  initialDocuments,
  bundleOptions,
  workspaceOptions,
}: EvidenceGridProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [bundles, setBundles] = useState(bundleOptions);
  const [filters, setFilters] = useState<EvidenceGridFilters>(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [peekDocumentId, setPeekDocumentId] = useState<string | null>(null);
  const [peekPayload, setPeekPayload] = useState<QuickPeekPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queueRef = useRef<GridMutation[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushingRef = useRef(false);

  const filteredDocuments = documents.filter((document) => {
    if (filters.workspaceId && document.jobId !== filters.workspaceId) {
      return false;
    }

    if (filters.bundleId && document.bundleId !== filters.bundleId) {
      return false;
    }

    if (
      filters.criterionCode &&
      !document.criteriaTags.some((tag) => tag.code === filters.criterionCode)
    ) {
      return false;
    }

    if (
      filters.disposition &&
      deriveDocumentDisposition(document) !== filters.disposition
    ) {
      return false;
    }

    if (filters.aiUnsure) {
      const hasUnsureTag =
        document.criteriaTags.some((tag) => tag.state === "suggested") ||
        document.criteriaTags.some((tag) => (tag.aiConfidence ?? tag.confidence) < 0.4);

      if (!hasUnsureTag) {
        return false;
      }
    }

    if (filters.search) {
      const needle = filters.search.trim().toLowerCase();
      if (needle && !buildSearchHaystack(document).includes(needle)) {
        return false;
      }
    }

    return true;
  });
  const peekIndex = filteredDocuments.findIndex((document) => document.id === peekDocumentId);
  const peekDocument = peekIndex >= 0 ? filteredDocuments[peekIndex] : null;
  const selectedSet = new Set(selectedIds);

  function openPeek(documentId: string) {
    setPeekPayload(null);
    setPeekDocumentId(documentId);
  }

  function closePeek() {
    setPeekPayload(null);
    setPeekDocumentId(null);
  }

  function stepPeek(nextDocumentId: string | null) {
    setPeekPayload(null);
    setPeekDocumentId(nextDocumentId);
  }

  async function reloadEvidence() {
    const response = await fetch(`/api/clients/${clientId}/evidence`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("The evidence grid could not be refreshed.");
    }

    const payload = (await response.json()) as {
      documents: EvidenceGridDocument[];
      bundles: typeof bundleOptions;
    };
    setDocuments(payload.documents);
    setBundles(payload.bundles);
  }

  function scheduleAutoSave() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void flushPendingMutations();
    }, 1500);
  }

  function enqueueMutation(mutation: GridMutation) {
    queueRef.current.push(mutation);
    setSaveState("unsaved");
    scheduleAutoSave();
  }

  async function sendMutation(mutation: GridMutation) {
    if (mutation.kind === "tag") {
      const response = await fetch(
        `/api/evidence/${mutation.documentId}/tags/${mutation.criterionCode}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: mutation.state,
            role: mutation.role,
          }),
        },
      );
      if (!response.ok) {
        throw new Error("A criterion tag could not be saved.");
      }
      return;
    }

    if (mutation.kind === "disposition") {
      const response = await fetch(`/api/evidence/${mutation.documentId}/disposition`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposition: mutation.disposition,
        }),
      });
      if (!response.ok) {
        throw new Error("The document disposition could not be saved.");
      }
      return;
    }

    if (mutation.kind === "bulk-tag") {
      const response = await fetch("/api/evidence/bulk-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: mutation.documentIds,
          criterionCode: mutation.criterionCode,
          state: mutation.state,
          role: mutation.role,
        }),
      });
      if (!response.ok) {
        throw new Error("The bulk tag action could not be saved.");
      }
      return;
    }

    if (mutation.kind === "bulk-disposition") {
      const response = await fetch("/api/evidence/bulk-disposition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: mutation.documentIds,
          disposition: mutation.disposition,
        }),
      });
      if (!response.ok) {
        throw new Error("The bulk disposition action could not be saved.");
      }
      return;
    }

    if (mutation.kind === "bulk-move") {
      const response = await fetch("/api/evidence/bulk-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: mutation.jobId,
          ids: mutation.documentIds,
          targetBundleId: mutation.targetBundleId,
        }),
      });
      if (!response.ok) {
        throw new Error("The bundle move could not be saved.");
      }
      await reloadEvidence();
    }
  }

  async function flushPendingMutations() {
    if (flushingRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (queueRef.current.length === 0) {
      setSaveState("saved");
      return;
    }

    flushingRef.current = true;
    setSaveState("saving");
    setErrorMessage(null);
    const batch = [...queueRef.current];
    queueRef.current = [];

    try {
      for (const mutation of batch) {
        const response = await sendMutation(mutation);
        void response;
      }
      setSaveState(queueRef.current.length > 0 ? "unsaved" : "saved");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Changes could not be saved.",
      );
      await reloadEvidence();
      setSaveState(queueRef.current.length > 0 ? "unsaved" : "saved");
    } finally {
      flushingRef.current = false;

      if (queueRef.current.length > 0) {
        scheduleAutoSave();
      }
    }
  }

  function updateDocumentLocally(
    documentId: string,
    updater: (document: EvidenceGridDocument) => EvidenceGridDocument,
  ) {
    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId ? updater(document) : document,
      ),
    );
  }

  function handleCycleCriterion(document: EvidenceGridDocument, criterionCode: string) {
    const existing = document.criteriaTags.find((tag) => tag.code === criterionCode);
    const nextState =
      !existing || existing.state === "disabled"
        ? { state: "enabled" as const, role: "supporting" as const }
        : existing.state === "suggested"
          ? { state: "enabled" as const, role: "supporting" as const }
          : existing.role === "supporting"
            ? { state: "enabled" as const, role: "primary" as const }
            : { state: "disabled" as const, role: existing.role };
    const next = upsertCriterionTag(document, criterionCode, nextState);

    updateDocumentLocally(document.id, (current) => ({
      ...current,
      criteriaTags: next.criteriaTags,
      disposition: next.disposition,
      reviewStatus: next.reviewStatus,
    }));
    enqueueMutation({
      kind: "tag",
      documentId: document.id,
      criterionCode,
      state: nextState.state,
      role: nextState.role,
    });
  }

  function handleToggleDisposition(
    document: EvidenceGridDocument,
    kind: "reference" | "archived",
  ) {
    const currentDisposition = deriveDocumentDisposition(document);
    const nextDisposition =
      currentDisposition === kind ? "untouched" : kind;
    const next = setDocumentDisposition(document, nextDisposition);

    updateDocumentLocally(document.id, (current) => ({
      ...current,
      criteriaTags: next.criteriaTags,
      disposition: next.disposition,
      reviewStatus: next.reviewStatus,
    }));
    enqueueMutation({
      kind: "disposition",
      documentId: document.id,
      disposition: nextDisposition,
    });
  }

  function handleSelect(documentId: string, checked: boolean, shiftKey: boolean) {
    if (!shiftKey || !lastSelectedId) {
      setSelectedIds((current) =>
        checked
          ? [...new Set([...current, documentId])]
          : current.filter((id) => id !== documentId),
      );
      setLastSelectedId(documentId);
      return;
    }

    const currentIndex = filteredDocuments.findIndex((document) => document.id === documentId);
    const previousIndex = filteredDocuments.findIndex(
      (document) => document.id === lastSelectedId,
    );

    if (currentIndex === -1 || previousIndex === -1) {
      setSelectedIds((current) =>
        checked
          ? [...new Set([...current, documentId])]
          : current.filter((id) => id !== documentId),
      );
      setLastSelectedId(documentId);
      return;
    }

    const [start, end] =
      currentIndex > previousIndex
        ? [previousIndex, currentIndex]
        : [currentIndex, previousIndex];
    const rangeIds = filteredDocuments.slice(start, end + 1).map((document) => document.id);

    setSelectedIds((current) =>
      checked
        ? [...new Set([...current, ...rangeIds])]
        : current.filter((id) => !rangeIds.includes(id)),
    );
    setLastSelectedId(documentId);
  }

  function applyBulkTag(criterionCode: string, role: "primary" | "supporting") {
    if (!selectedIds.length) {
      return;
    }
    if (!criterionCode) {
      return;
    }

    setDocuments((current) =>
      current.map((document) => {
        if (!selectedSet.has(document.id)) {
          return document;
        }

        const next = upsertCriterionTag(document, criterionCode, {
          state: "enabled",
          role,
          origin: "attorney",
        });

        return {
          ...document,
          criteriaTags: next.criteriaTags,
          disposition: next.disposition,
          reviewStatus: next.reviewStatus,
        };
      }),
    );
    enqueueMutation({
      kind: "bulk-tag",
      documentIds: [...selectedIds],
      criterionCode,
      state: "enabled",
      role,
    });
  }

  function applyBulkDisposition(disposition: "reference" | "archived") {
    if (!selectedIds.length) {
      return;
    }

    setDocuments((current) =>
      current.map((document) => {
        if (!selectedSet.has(document.id)) {
          return document;
        }

        const next = setDocumentDisposition(document, disposition);
        return {
          ...document,
          criteriaTags: next.criteriaTags,
          disposition: next.disposition,
          reviewStatus: next.reviewStatus,
        };
      }),
    );
    enqueueMutation({
      kind: "bulk-disposition",
      documentIds: [...selectedIds],
      disposition,
    });
  }

  function applyBulkMove(targetBundleId: string) {
    if (!selectedIds.length) {
      return;
    }

    const selectedDocuments = documents.filter((document) => selectedSet.has(document.id));
    const jobIds = [...new Set(selectedDocuments.map((document) => document.jobId))];

    if (jobIds.length !== 1) {
      setErrorMessage("Move to bundle works on one workspace selection at a time.");
      return;
    }

    const targetBundle = bundles.find((bundle) => bundle.id === targetBundleId) ?? null;

    setDocuments((current) =>
      current.map((document) =>
        selectedSet.has(document.id)
          ? {
              ...document,
              bundleId: targetBundleId,
              bundleName: targetBundle?.name ?? document.bundleName,
            }
          : document,
      ),
    );
    enqueueMutation({
      kind: "bulk-move",
      jobId: jobIds[0],
      documentIds: [...selectedIds],
      targetBundleId,
    });
  }

  useEffect(() => {
    if (!peekDocumentId) {
      return;
    }

    let active = true;

    async function loadPeek() {
      const response = await fetch(`/api/evidence/${peekDocumentId}/peek`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as QuickPeekPayload;

      if (active) {
        setPeekPayload(payload);
      }
    }

    void loadPeek();

    return () => {
      active = false;
    };
  }, [peekDocumentId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return (
    <section className="space-y-4">
      <GridToolbar
        clientName={clientName}
        documentCount={filteredDocuments.length}
        saveState={saveState}
        onSave={() => {
          void flushPendingMutations();
        }}
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        bundleOptions={bundles}
        workspaceOptions={workspaceOptions}
      />

      {selectedIds.length > 0 ? (
        <BulkActionBar
          selectedCount={selectedIds.length}
          bundleOptions={bundles}
          onPrimaryTag={(criterionCode) => applyBulkTag(criterionCode, "primary")}
          onSupportingTag={(criterionCode) =>
            applyBulkTag(criterionCode, "supporting")
          }
          onArchive={() => applyBulkDisposition("archived")}
          onReference={() => applyBulkDisposition("reference")}
          onMoveBundle={applyBulkMove}
          onClearSelection={() => setSelectedIds([])}
        />
      ) : null}

      {errorMessage ? (
        <div className="rounded-[16px] border border-[var(--state-danger)]/18 bg-[var(--state-danger-soft)] px-4 py-3 text-[12px] text-[var(--state-danger)]">
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[20px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: "44px" }} />
              <col style={{ width: "360px" }} />
              {Array.from({ length: 11 }).map((_, index) => (
                <col key={`criterion-col-${index}`} style={{ width: "50px" }} />
              ))}
              <col style={{ width: "72px" }} />
              <col style={{ width: "58px" }} />
              <col style={{ width: "58px" }} />
            </colgroup>
            <GridHeader />
            <tbody>
              {filteredDocuments.map((document) => (
                <GridRow
                  key={document.id}
                  document={document}
                  selected={selectedSet.has(document.id)}
                  highlighted={peekDocumentId === document.id}
                  onSelect={(checked, shiftKey) =>
                    handleSelect(document.id, checked, shiftKey)
                  }
                  onOpenPeek={() => openPeek(document.id)}
                  onCycleCriterion={(criterionCode) =>
                    handleCycleCriterion(document, criterionCode)
                  }
                  onToggleDisposition={(kind) =>
                    handleToggleDisposition(document, kind)
                  }
                />
              ))}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-3 border-t border-[var(--border-secondary)] px-4 py-3 text-[11px] text-[var(--muted)] lg:flex-row lg:items-center lg:justify-between">
          <span>{filteredDocuments.length} result(s)</span>
          <div className="flex flex-wrap gap-3">
            <span>Off = visible slot</span>
            <span>Suggested = Setu proposal</span>
            <span>Supporting = corroboration</span>
            <span>Primary = anchor evidence</span>
          </div>
        </footer>
      </div>

      <QuickPeekPanel
        document={peekDocument}
        payload={peekPayload}
        activeIndex={peekIndex === -1 ? 0 : peekIndex}
        total={filteredDocuments.length}
        onClose={closePeek}
        onPrevious={() => {
          if (!filteredDocuments.length) {
            return;
          }

          const nextIndex = peekIndex <= 0 ? filteredDocuments.length - 1 : peekIndex - 1;
          stepPeek(filteredDocuments[nextIndex]?.id ?? null);
        }}
        onNext={() => {
          if (!filteredDocuments.length) {
            return;
          }

          const nextIndex =
            peekIndex === -1 || peekIndex >= filteredDocuments.length - 1 ? 0 : peekIndex + 1;
          stepPeek(filteredDocuments[nextIndex]?.id ?? null);
        }}
      />
    </section>
  );
}
