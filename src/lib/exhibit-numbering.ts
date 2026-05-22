import type { ExhibitAssignment, ExhibitNumberingScheme } from "@/lib/types";

function alphaLabel(index: number) {
  return String.fromCharCode(65 + (index % 26));
}

export function buildDefaultLetterMap(criterionCodes: string[]) {
  return criterionCodes.reduce<Record<string, string>>((map, criterionCode, index) => {
    map[criterionCode] = alphaLabel(index);
    return map;
  }, {});
}

export function renderExhibitNumber(
  scheme: ExhibitNumberingScheme,
  assignment: Pick<ExhibitAssignment, "criterionCode" | "order">,
  position: number,
) {
  if (scheme.kind === "flat") {
    return `${position + 1}`;
  }

  if (scheme.kind === "section-grouped") {
    return `${position + 1}.${alphaLabel(assignment.order)}`;
  }

  const criterionLetter =
    (assignment.criterionCode && scheme.letterMap?.[assignment.criterionCode]) ||
    alphaLabel(position);
  return `${criterionLetter}-${assignment.order + 1}`;
}

export function renderExhibitLabel(
  scheme: ExhibitNumberingScheme,
  assignment: Pick<ExhibitAssignment, "criterionCode" | "order">,
  position: number,
) {
  return `Ex. ${renderExhibitNumber(scheme, assignment, position)}`;
}
