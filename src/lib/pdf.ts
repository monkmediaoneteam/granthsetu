import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Stamps a discreet license footer onto every page of a PDF document.
 * Includes buyer email, order ID, and copyright notice.
 *
 * Designed as a subtle deterrent against casual file distribution.
 */
export async function stampPdf(
  inputBuffer: Uint8Array | ArrayBuffer,
  licenseText: string
): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.load(inputBuffer, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const fontSize = 7.5;
    const color = rgb(0.29, 0.32, 0.31); // #4A524F ink-soft

    for (const page of pages) {
      const { width } = page.getSize();
      const textWidth = font.widthOfTextAtSize(licenseText, fontSize);
      // Center the text in the bottom margin (14pt from page bottom)
      const x = Math.max(16, (width - textWidth) / 2);
      const y = 14;

      page.drawText(licenseText, {
        x,
        y,
        size: fontSize,
        font,
        color,
        opacity: 0.7,
      });
    }

    return await pdfDoc.save();
  } catch (err) {
    console.error("[pdf-stamp] Error stamping PDF:", err);
    // If stamping fails, return original buffer without corrupting the download
    return inputBuffer instanceof Uint8Array ? inputBuffer : new Uint8Array(inputBuffer);
  }
}
