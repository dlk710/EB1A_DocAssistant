export const MODEL_PRICING = {
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00 },
  'gpt-4.1': { inputPer1M: 2.00, outputPer1M: 8.00 },
  'gpt-4.1-mini': { inputPer1M: 0.40, outputPer1M: 1.60 },
};

export function getModelPricing(model) {
  return MODEL_PRICING[model] || null;
}
