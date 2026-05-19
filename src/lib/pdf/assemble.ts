import fs from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { applyBatesStamp } from "@/lib/pdf/bates-stamp";

export interface RenderedPacketSection {
  pdfBytes: Uint8Array;
}

export async function assemblePacketPdf(
  sections: RenderedPacketSection[],
  outputPath?: string | null,
) {
  const finalPdf = await PDFDocument.create();

  for (const section of sections) {
    const source = await PDFDocument.load(section.pdfBytes);
    const copied = await finalPdf.copyPages(source, source.getPageIndices());
    copied.forEach((page) => finalPdf.addPage(page));
  }

  await applyBatesStamp(finalPdf);
  const bytes = await finalPdf.save();

  if (outputPath) {
    await fs.writeFile(outputPath, Buffer.from(bytes));
  }

  return new Uint8Array(bytes);
}
