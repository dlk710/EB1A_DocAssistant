import { getCriterionDisplayName } from "@/lib/constants";

export interface CriterionPromptDefinition {
  promptKey: string;
  structuralRequirement: string;
  sectionLabel: string;
  subclaims: Array<{
    title: string;
    supportsClaim: string;
  }>;
}

export interface CriterionTreeBlueprint {
  rootTitle: string;
  sections: Array<{
    title: string;
    supportsClaim: string;
    children: Array<{
      title: string;
      supportsClaim: string;
    }>;
  }>;
}

export const SHARED_CRITERION_DRAFT_REQUIREMENTS = [
  "Use declarative voice. State the claim; let the citation carry it.",
  "Every paragraph references at least one exhibit by its canonical number.",
  "Introduce no factual claim, number, percentage, currency figure, date, or named fact unless it is supported by a document in the workspace.",
  "Where a sub-claim is backed by a third-party expert, quote the letter VERBATIM via an endorsement quote object. Never paraphrase a letter into a quote.",
  "Refer to the regulation by its citation.",
  "Use the petitioner's legal name and honorific consistently: {{petitioner.legalName}}, {{petitioner.honorific}}.",
  "Produce prose for the requested subsection and keep it compatible with the surrounding SubsectionDraft tree.",
  "Match the voice of the supplied style exemplars: {{styleExemplars}}.",
  "If evidence for a required sub-claim is missing, emit a gap note. Do not invent.",
].join("\n");

const CRITERION_PROMPT_DEFINITIONS: Record<string, CriterionPromptDefinition> = {
  "01": {
    promptKey: "awards",
    structuralRequirement:
      "Per award, prove the awarding body and its standing, the selection process and competitiveness, the petitioner's position against the cohort, and recognition of the award beyond the awarding body. Reject employer-internal awards as nationally recognized; emit a gap note instead.",
    sectionLabel: "Award unit",
    subclaims: [
      {
        title: "Awarding body and standing",
        supportsClaim: "Establishes the awarding body's reputation and scope.",
      },
      {
        title: "Selection process and competitiveness",
        supportsClaim: "Explains why selection reflects outstanding achievement.",
      },
      {
        title: "Position against the cohort",
        supportsClaim: "Shows how the petitioner ranked against peers.",
      },
      {
        title: "Recognition beyond the awarding body",
        supportsClaim: "Shows the award carried recognition beyond the issuing body.",
      },
    ],
  },
  "02": {
    promptKey: "memberships",
    structuralRequirement:
      "Per membership, prove the association, that membership requires outstanding achievement judged by recognized experts rather than dues, and the petitioner's specific qualifying achievement. Distinguish open membership from achievement-gated membership.",
    sectionLabel: "Membership unit",
    subclaims: [
      {
        title: "Association and standing",
        supportsClaim: "Identifies the association and why it matters in the field.",
      },
      {
        title: "Outstanding-achievement gatekeeping",
        supportsClaim: "Shows that admission is merit-based and expert-judged.",
      },
      {
        title: "Petitioner's qualifying achievement",
        supportsClaim: "Connects the petitioner to the standards required for admission.",
      },
    ],
  },
  "03": {
    promptKey: "published-material",
    structuralRequirement:
      "Per publication, prove the publication and its standing, the article's date, title, and author, that the article is about the petitioner and the petitioner's work rather than a passing mention, and that it is independent editorial coverage rather than sponsored content or a press release. Flag suspected pay-to-publish or sponsored outlets as a gap.",
    sectionLabel: "Publication unit",
    subclaims: [
      {
        title: "Publication and standing",
        supportsClaim: "Shows why the outlet carries independent weight.",
      },
      {
        title: "Article details",
        supportsClaim: "Anchors the date, title, author, and provenance of the piece.",
      },
      {
        title: "Material is about the petitioner",
        supportsClaim: "Shows the coverage centers on the petitioner and the petitioner's work.",
      },
      {
        title: "Independent editorial coverage",
        supportsClaim: "Shows the material is editorial rather than self-promotional.",
      },
    ],
  },
  "04": {
    promptKey: "judging",
    structuralRequirement:
      "Per judging instance, prove the event, journal, or program and the standing of the body running it, the petitioner's specific role, the volume of judging work, whether the activity is sustained or episodic, and field alignment. Characterize sustained versus one-time service explicitly.",
    sectionLabel: "Judging unit",
    subclaims: [
      {
        title: "Program and standing",
        supportsClaim: "Shows the judging forum is reputable and field-aligned.",
      },
      {
        title: "Specific judging role",
        supportsClaim: "Shows the petitioner was invited to judge the work of others.",
      },
      {
        title: "Volume and continuity",
        supportsClaim: "Shows whether the judging activity was sustained or episodic.",
      },
      {
        title: "Field alignment",
        supportsClaim: "Shows the judging work sits in the same or an allied field.",
      },
    ],
  },
  "05": {
    promptKey: "original-contributions",
    structuralRequirement:
      "Per contribution, produce two separable proven sub-claims: originality and major significance. Distinguish the petitioner's specific contribution from the overall project's significance. Require at least one independent endorsement quote where possible.",
    sectionLabel: "Contribution unit",
    subclaims: [
      {
        title: "Originality",
        supportsClaim: "Shows what the contribution is and why it was novel.",
      },
      {
        title: "Major significance",
        supportsClaim: "Shows impact at scale, adoption, and significance beyond one team.",
      },
      {
        title: "Independent endorsement",
        supportsClaim: "Provides third-party validation from a non-employer source where available.",
      },
    ],
  },
  "06": {
    promptKey: "authorship",
    structuralRequirement:
      "Per article, prove the article, venue, date, authorship position, the venue's standing, and that the venue is not predatory or pay-to-publish. Flag suspected predatory venues as a gap.",
    sectionLabel: "Authorship unit",
    subclaims: [
      {
        title: "Article and venue",
        supportsClaim: "Identifies the article and the publishing venue.",
      },
      {
        title: "Venue standing",
        supportsClaim: "Shows the venue is selective, peer-reviewed, or otherwise credible.",
      },
      {
        title: "Petitioner's authorship role",
        supportsClaim: "Shows the petitioner's role in authorship and publication.",
      },
    ],
  },
  "07": {
    promptKey: "exhibitions",
    structuralRequirement:
      "Per exhibition or showcase, prove the exhibition, the venue standing, and the petitioner's work in it. For non-artistic fields, move to comparable evidence instead of forcing a standard exhibition theory.",
    sectionLabel: "Exhibition unit",
    subclaims: [
      {
        title: "Exhibition and venue standing",
        supportsClaim: "Shows the exhibition or showcase carries recognized standing.",
      },
      {
        title: "Petitioner's displayed work",
        supportsClaim: "Shows the petitioner had work displayed in the exhibition.",
      },
    ],
  },
  "08": {
    promptKey: "leading-critical-role",
    structuralRequirement:
      "Per distinguished organization, prove that the organization is distinguished, the petitioner held a leading role, and the petitioner's role was critical. Each initiative under critical role should carry at least one endorsement quote, ideally from a supervisor or senior leader.",
    sectionLabel: "Organization unit",
    subclaims: [
      {
        title: "Organization is distinguished",
        supportsClaim: "Shows the organization has standing, scale, or recognized distinction.",
      },
      {
        title: "Leading role",
        supportsClaim: "Shows title, reporting line, scope of authority, and leadership duties.",
      },
      {
        title: "Critical role",
        supportsClaim: "Shows the petitioner's role was important and consequential to the organization.",
      },
      {
        title: "Leader endorsement",
        supportsClaim: "Adds direct leader testimony about the petitioner's criticality and irreplaceability.",
      },
    ],
  },
  "09": {
    promptKey: "high-remuneration",
    structuralRequirement:
      "Produce a section proving the petitioner's compensation, a field- and role-specific benchmark, and that the petitioner's compensation significantly exceeds the benchmark.",
    sectionLabel: "Compensation unit",
    subclaims: [
      {
        title: "Petitioner's compensation",
        supportsClaim: "Shows what the petitioner was paid or compensated.",
      },
      {
        title: "Field benchmark",
        supportsClaim: "Shows an appropriate benchmark for similarly situated professionals.",
      },
      {
        title: "Exceeds the benchmark",
        supportsClaim: "Shows the petitioner's remuneration materially exceeds the benchmark.",
      },
    ],
  },
  "10": {
    promptKey: "commercial-success",
    structuralRequirement:
      "Per work, prove the work, the commercial success metrics, and benchmarking against the field.",
    sectionLabel: "Commercial success unit",
    subclaims: [
      {
        title: "Work and release",
        supportsClaim: "Identifies the work that generated commercial success.",
      },
      {
        title: "Commercial success metrics",
        supportsClaim: "Shows sales, revenue, box office, or equivalent commercial metrics.",
      },
      {
        title: "Field benchmark",
        supportsClaim: "Shows those metrics compare favorably against the field.",
      },
    ],
  },
  "11": {
    promptKey: "comparable-evidence",
    structuralRequirement:
      "Produce an explicit invocation of the comparable-evidence provision, explain why the standard criterion does not naturally apply to {{petitioner.field}}, explain why the alternative evidence is comparable in kind and weight, and then prove each alternative item with standing, role, and peer significance.",
    sectionLabel: "Comparable evidence unit",
    subclaims: [
      {
        title: "Comparable evidence rationale",
        supportsClaim: "Explains why the standard criterion does not fit and why this evidence is comparable.",
      },
      {
        title: "Alternative evidence item",
        supportsClaim: "Shows the item and the standing of the body involved.",
      },
      {
        title: "Peer significance",
        supportsClaim: "Shows peers in the field treat the evidence as comparable in weight.",
      },
    ],
  },
};

export function getCriterionPromptDefinition(criterionCode: string) {
  return (
    CRITERION_PROMPT_DEFINITIONS[criterionCode] ??
    {
      promptKey: "generic-criterion",
      structuralRequirement:
        "Prove the criterion with discrete argument units, each broken into the concrete sub-claims needed to satisfy the regulation. Emit gap notes instead of inventing evidence.",
      sectionLabel: "Argument unit",
      subclaims: [
        {
          title: "Primary claim",
          supportsClaim: "Proves the core regulatory element for this unit.",
        },
        {
          title: "Corroboration",
          supportsClaim: "Adds corroborating evidence and third-party validation where available.",
        },
      ],
    } satisfies CriterionPromptDefinition
  );
}

export function renderCriterionPromptTemplate(input: {
  criterionCode: string;
  kind: "standard" | "comparable-evidence";
}) {
  const key = input.kind === "comparable-evidence" ? "11" : input.criterionCode;
  const definition = getCriterionPromptDefinition(key);

  return [
    `Criterion structure: ${getCriterionDisplayName(input.criterionCode, input.criterionCode)}.`,
    `Structural requirement: ${definition.structuralRequirement}`,
    SHARED_CRITERION_DRAFT_REQUIREMENTS,
  ].join("\n");
}

export function buildCriterionTreeBlueprint(input: {
  criterionCode: string;
  kind: "standard" | "comparable-evidence";
  sectionUnits: string[];
}) {
  const key = input.kind === "comparable-evidence" ? "11" : input.criterionCode;
  const definition = getCriterionPromptDefinition(key);
  const units = input.sectionUnits.length
    ? input.sectionUnits
    : [`${definition.sectionLabel} 1`];

  return {
    rootTitle: getCriterionDisplayName(input.criterionCode, input.criterionCode),
    sections: units.map((unitTitle, index) => ({
      title: units.length === 1 ? unitTitle : `${unitTitle} ${index + 1}`,
      supportsClaim: definition.structuralRequirement,
      children: definition.subclaims.map((subclaim) => ({
        title: subclaim.title,
        supportsClaim: subclaim.supportsClaim,
      })),
    })),
  } satisfies CriterionTreeBlueprint;
}
