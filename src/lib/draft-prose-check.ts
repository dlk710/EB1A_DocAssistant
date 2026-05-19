import type { DraftParagraph } from "@/lib/types";

const GENERIC_PHRASES = [
  "groundbreaking",
  "remarkable",
  "unprecedented",
  "demonstrates",
  "underscores",
  "showcases",
  "truly",
  "world-class",
  "exceptional",
  "transformative",
];

export interface GenericProseCheckResult {
  triggered: boolean;
  score: number;
  matchedPhrases: string[];
  message: string | null;
}

function countPhrase(value: string, phrase: string) {
  const matches = value.match(new RegExp(`\\b${phrase.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "gi"));
  return matches?.length ?? 0;
}

export function runGenericProseCheck(paragraphs: Array<Pick<DraftParagraph, "text">>): GenericProseCheckResult {
  const joined = paragraphs.map((paragraph) => paragraph.text).join("\n");
  const perPhrase = GENERIC_PHRASES.map((phrase) => ({
    phrase,
    count: countPhrase(joined, phrase),
  })).filter((entry) => entry.count > 0);
  const score = perPhrase.reduce((sum, entry) => sum + entry.count, 0);
  const shortParagraphSpike = paragraphs.some((paragraph) => {
    const wordCount = paragraph.text.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 80) {
      return false;
    }
    return perPhrase.reduce((sum, entry) => sum + countPhrase(paragraph.text, entry.phrase), 0) >= 3;
  });
  const triggered = shortParagraphSpike || score >= 8;

  return {
    triggered,
    score,
    matchedPhrases: perPhrase.flatMap((entry) => Array(entry.count).fill(entry.phrase)),
    message: triggered
      ? "This draft uses several common AI phrases. Consider editing for originality before approving."
      : null,
  };
}
