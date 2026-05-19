import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";
import type { AuditFinding, CriterionDraft, PetitionSection, SynthesisDraft } from "@/lib/types";

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export function buildAuditFindings(input: {
  pinnedEntries: Array<{ exhibitLabel: string; criterionCode: string }>;
  sectionTexts: Array<{ sectionId: string; text: string }>;
  exhibitLabels: string[];
  criterionDrafts: CriterionDraft[];
  synthesisDrafts: SynthesisDraft[];
  criterionReferences: Array<{ sectionId: string; references: string[] }>;
  totalPages: number;
  sections: PetitionSection[];
  unsupportedExhibits?: Array<{ exhibitLabel: string; reason: string }>;
}): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const packetText = input.sectionTexts.map((section) => section.text).join("\n");
  const criterionLegalCodeLookup = new Map<string, string>(
    EB1A_CRITERIA_DEFINITIONS.map((criterion) => [
      criterion.code,
      criterion.legalCode.toLowerCase(),
    ]),
  );

  input.pinnedEntries.forEach((entry) => {
    if (!packetText.includes(entry.exhibitLabel)) {
      findings.push({
        id: `pinned-uncited:${entry.criterionCode}:${entry.exhibitLabel}`,
        severity: "warning",
        kind: "pinned-exhibit-uncited",
        description: `${entry.exhibitLabel} is pinned for criterion ${entry.criterionCode} but is not cited in the approved petition text.`,
        affectedExhibit: entry.exhibitLabel,
        suggestedActions: [
          { label: "Include in packet anyway", action: "accept-warning" },
          { label: "Edit draft to cite", action: "open-drafting" },
        ],
      });
    }
  });

  unique(
    input.sectionTexts.flatMap((section) =>
      [...section.text.matchAll(/\bEx\.\s*([0-9]+[A-Z]?)\b/gi)].map((match) => ({
        sectionId: section.sectionId,
        label: `Ex. ${match[1].toUpperCase()}`,
      })),
    ),
  ).forEach((reference) => {
    if (!input.exhibitLabels.includes(reference.label)) {
      findings.push({
        id: `missing-exhibit:${reference.sectionId}:${reference.label}`,
        severity: "blocking",
        kind: "cited-exhibit-missing",
        description: `${reference.label} is cited in the petition text but does not exist in the locked exhibit set.`,
        affectedSection: reference.sectionId,
        affectedExhibit: reference.label,
        suggestedActions: [{ label: "Edit draft reference", action: "open-source-section" }],
      });
    }
  });

  input.criterionReferences.forEach((section) => {
    section.references.forEach((reference) => {
      const exists = input.criterionDrafts.some((draft) => {
        const version = draft.versions.find((candidate) => candidate.version === draft.latestApprovedVersion);
        const legalCode = criterionLegalCodeLookup.get(draft.criterionCode);
        return Boolean(
          version &&
            version.paragraphs.length > 0 &&
            legalCode &&
            reference.trim().toLowerCase() === legalCode,
        );
      });
      if (!exists) {
        findings.push({
          id: `criterion-out-of-sync:${section.sectionId}:${reference}`,
          severity: "blocking",
          kind: "criterion-reference-out-of-sync",
          description: `${reference} is referenced in synthesis, but the corresponding approved criterion draft is not current.`,
          affectedSection: section.sectionId,
          suggestedActions: [
            { label: "Regenerate synthesis", action: "open-synthesis" },
            { label: "Re-approve current draft", action: "open-drafting" },
          ],
        });
      }
    });
  });

  input.criterionDrafts.forEach((draft) => {
    const latestVersion = draft.versions.at(-1)?.version ?? null;
    if (
      draft.latestApprovedVersion != null &&
      latestVersion !== null &&
      latestVersion > draft.latestApprovedVersion
    ) {
      findings.push({
        id: `draft-out-of-date:${draft.criterionCode}`,
        severity: "warning",
        kind: "draft-source-out-of-date",
        description: `${draft.criterionCode} has edits newer than the approved version.`,
        affectedSection: draft.criterionCode,
        suggestedActions: [
          { label: "Re-approve latest version", action: "open-drafting" },
          { label: "Use approved version", action: "accept-warning" },
        ],
      });
    }
  });

  input.synthesisDrafts.forEach((draft) => {
    const latestVersion = draft.versions.at(-1)?.version ?? null;
    if (
      draft.latestApprovedVersion !== null &&
      latestVersion !== null &&
      latestVersion > draft.latestApprovedVersion
    ) {
      findings.push({
        id: `synthesis-out-of-date:${draft.kind}`,
        severity: "warning",
        kind: "draft-source-out-of-date",
        description: `${draft.kind.replaceAll("-", " ")} has edits newer than the approved version.`,
        affectedSection: draft.kind,
        suggestedActions: [
          { label: "Re-approve latest version", action: "open-synthesis" },
          { label: "Use approved version", action: "accept-warning" },
        ],
      });
    }
  });

  const numericExhibits = input.exhibitLabels
    .map((label) => {
      const match = label.match(/Ex\.\s*(\d+)/i);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  for (let index = 1; index <= (numericExhibits.at(-1) ?? 0); index += 1) {
    if (!numericExhibits.includes(index)) {
      findings.push({
        id: `numbering-gap:${index}`,
        severity: "info",
        kind: "exhibit-numbering-gap",
        description: `The locked exhibit sequence skips Ex. ${index}.`,
        affectedExhibit: `Ex. ${index}`,
        suggestedActions: [{ label: "Renumber on next unlock", action: "accept-info" }],
      });
    }
  }

  const totalSectionPages = input.sections.reduce((sum, section) => sum + section.pageCount, 0);
  if (totalSectionPages !== input.totalPages) {
    findings.push({
      id: "bates-pagination-error",
      severity: "blocking",
      kind: "bates-pagination-error",
      description: "Section page counts do not sum to the packet total.",
      suggestedActions: [{ label: "Regenerate packet", action: "regenerate-packet" }],
    });
  }

  (input.unsupportedExhibits ?? []).forEach((entry) => {
    findings.push({
      id: `unsupported:${entry.exhibitLabel}`,
      severity: "blocking",
      kind: "unsupported-exhibit-type",
      description: `${entry.exhibitLabel} cannot be rendered into the packet yet: ${entry.reason}.`,
      affectedExhibit: entry.exhibitLabel,
      suggestedActions: [{ label: "Replace or remove exhibit", action: "open-lock" }],
    });
  });

  return findings;
}
