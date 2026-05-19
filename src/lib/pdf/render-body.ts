import { PDFParse } from "pdf-parse";
import puppeteer from "puppeteer-core";
import { LETTER_HEIGHT_PX, LETTER_WIDTH_PX, resolveBrowserExecutable } from "@/lib/pdf/browser";

async function pageCountFromPdf(pdfBytes: Uint8Array) {
  const parser = new PDFParse({ data: Buffer.from(pdfBytes) });
  const parsed = await parser.getInfo({ parsePageInfo: false });
  await parser.destroy();
  return parsed.total ?? 1;
}

export async function renderHtmlToPdf(html: string) {
  const executablePath = resolveBrowserExecutable();
  if (!executablePath) {
    throw new Error("Chrome is required locally to render petition PDFs.");
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: LETTER_WIDTH_PX, height: LETTER_HEIGHT_PX, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.waitForNetworkIdle({
      idleTime: 300,
      timeout: 3_000,
    });
    const pdfBytes = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0in", right: "0in", bottom: "0in", left: "0in" },
    });
    return {
      pdfBytes,
      pageCount: await pageCountFromPdf(pdfBytes),
    };
  } finally {
    await browser.close();
  }
}

export async function renderFileUrlToPdf(fileUrl: string) {
  const executablePath = resolveBrowserExecutable();
  if (!executablePath) {
    throw new Error("Chrome is required locally to render petition PDFs.");
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--allow-file-access-from-files"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: LETTER_WIDTH_PX, height: LETTER_HEIGHT_PX, deviceScaleFactor: 1 });
    await page.goto(fileUrl, { waitUntil: "networkidle0" });
    const pdfBytes = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0in", right: "0in", bottom: "0in", left: "0in" },
    });
    return {
      pdfBytes,
      pageCount: await pageCountFromPdf(pdfBytes),
    };
  } finally {
    await browser.close();
  }
}
