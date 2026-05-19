import { StandardFonts, rgb, type PDFDocument } from "pdf-lib";
import { formatBatesNumber } from "@/lib/bates";

export async function applyBatesStamp(pdfDocument: PDFDocument) {
  const font = await pdfDocument.embedFont(StandardFonts.Helvetica);
  const pages = pdfDocument.getPages();

  pages.forEach((page, index) => {
    const { width } = page.getSize();
    const bates = formatBatesNumber(index + 1);
    page.drawText(bates, {
      x: width - 140,
      y: 18,
      size: 9,
      font,
      color: rgb(0.1, 0.1, 0.12),
    });

    if (index === 0) {
      page.drawText("setu", {
        x: 36,
        y: 18,
        size: 9,
        font,
        color: rgb(0.73, 0.46, 0.09),
      });
    }
  });
}
