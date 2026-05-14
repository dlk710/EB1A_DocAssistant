import OpenAI from "openai";
import { getRuntimeSettings } from "@/lib/settings";

let cachedClient: OpenAI | null = null;
let cachedKey: string | null = null;

export function getOpenAiContext() {
  const settings = getRuntimeSettings();

  if (!settings.openAiApiKey) {
    throw new Error("OpenAI API key is not configured. Add it in Settings to continue.");
  }

  if (!cachedClient || cachedKey !== settings.openAiApiKey) {
    cachedClient = new OpenAI({
      apiKey: settings.openAiApiKey,
    });
    cachedKey = settings.openAiApiKey;
  }

  return {
    client: cachedClient,
    settings,
  };
}
