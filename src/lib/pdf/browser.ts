import fs from "node:fs";

export const LETTER_WIDTH_PX = 816;
export const LETTER_HEIGHT_PX = 1056;

export function resolveBrowserExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}
