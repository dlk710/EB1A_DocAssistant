import { calculateTextModelCost } from "@/lib/openai-pricing";
import { getOpenAiContext } from "@/lib/openai";
import type { ChatMode, ModeClassification } from "@/lib/types";

const modeClassificationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: {
      type: "string",
      enum: ["triage", "strategy", "stress-test", "draft"],
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    alternateMode: {
      type: ["string", "null"],
      enum: ["triage", "strategy", "stress-test", "draft", null],
    },
  },
  required: ["mode", "confidence", "alternateMode"],
} as const;

function fallbackClassifyMode(message: string): ModeClassification {
  const normalized = message.toLowerCase();

  if (
    /\b(risk|challenge|rfe|skeptic|weakness|stress)\b/.test(normalized)
  ) {
    return { mode: "stress-test", confidence: 0.72, alternateMode: "strategy" };
  }

  if (/\b(draft|rewrite|paragraph|introduction|conclusion|argument)\b/.test(normalized)) {
    return { mode: "draft", confidence: 0.74, alternateMode: "strategy" };
  }

  if (
    /\b(strategy|lead argument|criteria|petition theory|which criteria|case theory)\b/.test(
      normalized,
    )
  ) {
    return { mode: "strategy", confidence: 0.78, alternateMode: "triage" };
  }

  return { mode: "triage", confidence: 0.8, alternateMode: null };
}

export async function classifyChatMode(input: {
  message: string;
  modeHint?: ChatMode | null;
}) {
  if (input.modeHint) {
    return {
      classification: {
        mode: input.modeHint,
        confidence: 1,
        alternateMode: null,
      } satisfies ModeClassification,
      costUsd: 0,
    };
  }

  try {
    const { client, settings } = getOpenAiContext();
    const response = await client.responses.create({
      model: settings.summaryModel,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "Classify the user's message into one of four Setu chat modes.",
                "triage = specific document or evidence question.",
                "strategy = petition theory, criteria mix, gaps, or risks.",
                "stress-test = skeptical USCIS-style weakness finding.",
                "draft = prose drafting for a petition section.",
                "If uncertain, choose the best mode and provide an alternate mode.",
                "Return strict JSON only.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: input.message }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "setu_chat_mode_classifier",
          strict: true,
          schema: modeClassificationJsonSchema,
        },
      },
    });

    const payload = JSON.parse(response.output_text) as ModeClassification;

    return {
      classification: {
        mode: payload.mode,
        confidence: Math.max(0, Math.min(1, payload.confidence)),
        alternateMode: payload.alternateMode,
      } satisfies ModeClassification,
      costUsd:
        calculateTextModelCost({
          model: settings.summaryModel,
          inputTokens: response.usage?.input_tokens ?? 0,
          cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
        }) ?? 0,
    };
  } catch {
    return {
      classification: fallbackClassifyMode(input.message),
      costUsd: 0,
    };
  }
}
