interface TextPricing {
  input: number;
  cachedInput: number;
  output: number;
}

interface EmbeddingPricing {
  input: number;
}

const TEXT_MODEL_PRICING: Record<string, TextPricing> = {
  "gpt-4.1": { input: 2, cachedInput: 0.5, output: 8 },
  "gpt-4.1-2025-04-14": { input: 2, cachedInput: 0.5, output: 8 },
  "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
  "gpt-4.1-mini-2025-04-14": { input: 0.4, cachedInput: 0.1, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, cachedInput: 0.025, output: 0.4 },
  "gpt-4.1-nano-2025-04-14": { input: 0.1, cachedInput: 0.025, output: 0.4 },
};

const EMBEDDING_MODEL_PRICING: Record<string, EmbeddingPricing> = {
  "text-embedding-3-small": { input: 0.02 },
  "text-embedding-3-large": { input: 0.13 },
};

function roundUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function calculateTextModelCost(input: {
  model: string;
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
}) {
  const pricing = TEXT_MODEL_PRICING[input.model];

  if (!pricing) {
    return null;
  }

  const cachedTokens = Math.min(input.cachedInputTokens ?? 0, input.inputTokens);
  const uncachedTokens = Math.max(input.inputTokens - cachedTokens, 0);

  return roundUsd(
    (uncachedTokens / 1_000_000) * pricing.input +
      (cachedTokens / 1_000_000) * pricing.cachedInput +
      (input.outputTokens / 1_000_000) * pricing.output,
  );
}

export function calculateEmbeddingCost(input: {
  model: string;
  inputTokens: number;
}) {
  const pricing = EMBEDDING_MODEL_PRICING[input.model];

  if (!pricing) {
    return null;
  }

  return roundUsd((input.inputTokens / 1_000_000) * pricing.input);
}
