import type { BatesRange, PetitionSection } from "@/lib/types";

export function formatBatesNumber(pageNumber: number) {
  return `PET-${pageNumber.toString().padStart(6, "0")}`;
}

export function buildBatesRange(startPage: number, pageCount: number): BatesRange {
  return {
    start: formatBatesNumber(startPage),
    end: formatBatesNumber(startPage + Math.max(pageCount - 1, 0)),
  };
}

export function applyBatesRanges<T extends PetitionSection>(sections: T[]) {
  let nextPage = 1;
  return sections.map((section) => {
    const pageCount = Math.max(1, section.pageCount);
    const nextSection = {
      ...section,
      bates: buildBatesRange(nextPage, pageCount),
    };
    nextPage += pageCount;
    return nextSection;
  });
}

export function totalPagesFromSections(sections: Array<Pick<PetitionSection, "pageCount">>) {
  return sections.reduce((sum, section) => sum + Math.max(1, section.pageCount), 0);
}
