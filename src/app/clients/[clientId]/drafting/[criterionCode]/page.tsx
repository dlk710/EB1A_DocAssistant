import { notFound, redirect } from "next/navigation";
import { DraftingWorkspace } from "@/components/drafting/DraftingWorkspace";
import { deriveDocumentDisposition, hasEnabledCriterionTag } from "@/lib/criterion-tags";
import { getClient } from "@/lib/clients";
import { extractCandidateEndorsementQuotes } from "@/lib/endorsement-quotes";
import { buildLibrarySnapshot } from "@/lib/library";
import { ensureCriterionDraft, listCriterionDrafts } from "@/lib/drafts";
import { getLockedStrategy } from "@/lib/lock";
import { getCriterionPinboard } from "@/lib/pinboards";
import { getDocumentsForJobs } from "@/lib/qdrant";
import { listSubsections } from "@/lib/subsection-drafts";

interface CriterionDraftingPageProps {
  params: Promise<{
    clientId: string;
    criterionCode: string;
  }>;
}

function tabStatus(draft: ReturnType<typeof ensureCriterionDraft>) {
  if (draft?.status === "out-of-date") {
    return {
      status: "out-of-date" as const,
      versionLabel: draft.versions.length
        ? `v${draft.versions.at(-1)?.version} · out of date`
        : "out of date",
    };
  }
  if (!draft || !draft.versions.length) {
    return {
      status: "not-started" as const,
      versionLabel: "not started",
    };
  }
  if (draft.status === "approved") {
    return {
      status: "approved" as const,
      versionLabel: `v${draft.latestApprovedVersion} approved`,
    };
  }
  return {
    status: "in-progress" as const,
    versionLabel: `v${draft.versions.at(-1)?.version} · in progress`,
  };
}

export default async function CriterionDraftingPage({ params }: CriterionDraftingPageProps) {
  const { clientId, criterionCode } = await params;
  const client = getClient(clientId);
  if (!client) {
    notFound();
  }

  const lockedStrategy = getLockedStrategy(clientId);
  if (!lockedStrategy) {
    redirect(`/clients/${clientId}/lock`);
  }

  const criterionEntry = [...lockedStrategy.primary, ...lockedStrategy.supporting].find(
    (entry) => entry.criterionCode === criterionCode,
  );
  if (!criterionEntry) {
    notFound();
  }

  const snapshot = await buildLibrarySnapshot({ clientId });
  const pinboard = getCriterionPinboard(clientId, criterionCode);
  const documentLookup = new Map(snapshot.clientDocuments.map((document) => [document.id, document]));
  const pinboardEntries = (pinboard?.entries ?? []).map((entry) => {
    const document = documentLookup.get(entry.documentId);
    return {
      ...entry,
      title: document?.summary?.title || document?.fileName || entry.documentId,
      fileName: document?.fileName || entry.documentId,
    };
  });

  const sectionUnits = pinboardEntries.length
    ? pinboardEntries.map((entry, index) => `${criterionEntry.criterionName} unit ${index + 1} · ${entry.exhibitLabel}`)
    : [`${criterionEntry.criterionName} unit 1`];
  const draft = ensureCriterionDraft(clientId, criterionCode, {
    sectionUnits,
  });

  const draftByCode = new Map(listCriterionDrafts(clientId).map((entry) => [entry.criterionCode, entry]));
  const tabs = [...lockedStrategy.primary, ...lockedStrategy.supporting].map((entry) => {
    const currentDraft =
      draftByCode.get(entry.criterionCode) ??
      ensureCriterionDraft(clientId, entry.criterionCode, {
        sectionUnits: entry.anchorExhibits.map(
          (assignment, index) => `${entry.criterionName} unit ${index + 1} · ${assignment.exhibitLabel}`,
        ),
      });
    const status = tabStatus(currentDraft);
    return {
      criterionCode: entry.criterionCode,
      legalCode: entry.legalCode,
      name: entry.criterionName,
      href: `/clients/${clientId}/drafting/${entry.criterionCode}`,
      active: entry.criterionCode === criterionCode,
      ...status,
    };
  });

  const suggestedDocuments = snapshot.clientDocuments
    .filter(
      (document) =>
        hasEnabledCriterionTag(document, criterionCode) &&
        deriveDocumentDisposition(document) === "tagged" &&
        !pinboardEntries.some((entry) => entry.documentId === document.id),
    )
    .slice(0, 10)
    .map((document) => ({
      id: document.id,
      title: document.summary?.title || document.fileName,
      fileName: document.fileName,
    }));

  const rawDocuments = await getDocumentsForJobs(snapshot.clientWorkspaces.map((workspace) => workspace.id));
  const criterionDocIds = new Set(
    snapshot.clientDocuments
      .filter(
        (document) =>
          hasEnabledCriterionTag(document, criterionCode) &&
          deriveDocumentDisposition(document) === "tagged",
      )
      .map((document) => document.id),
  );
  pinboardEntries.forEach((entry) => criterionDocIds.add(entry.documentId));
  const criterionDocuments = rawDocuments.filter((document) => criterionDocIds.has(document.id));
  const exhibitLookup = new Map(
    [...criterionEntry.anchorExhibits, ...pinboardEntries].map((entry) => [
      entry.documentId,
      entry.exhibitLabel,
    ]),
  );
  const quoteSuggestionsBySubsection = Object.fromEntries(
    await Promise.all(
      listSubsections(draft!.root).map(async (subsection) => [
        subsection.id,
        await extractCandidateEndorsementQuotes({
          documents: criterionDocuments,
          subsectionId: subsection.id,
          supportsClaim: subsection.supportsClaim || subsection.title,
          exhibitLookup,
        }),
      ]),
    ),
  );

  return (
    <DraftingWorkspace
      clientId={clientId}
      clientName={client.displayName}
      criterionCode={criterionCode}
      criterionName={criterionEntry.criterionName}
      criterionLegalCode={criterionEntry.legalCode}
      tabs={tabs}
      draft={draft!}
      pinboardEntries={pinboardEntries}
      suggestedDocuments={suggestedDocuments}
      strategyRationale={criterionEntry.rationale}
      narrativeSpine={lockedStrategy.narrativeSpine}
      anchorExhibits={criterionEntry.anchorExhibits.map((assignment) => assignment.exhibitLabel)}
      quoteSuggestionsBySubsection={quoteSuggestionsBySubsection}
    />
  );
}
