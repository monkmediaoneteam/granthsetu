import assert from "node:assert/strict";
import { PDFDocument, rgb } from "pdf-lib";
import { stampPdf } from "../src/lib/pdf.ts";

async function run() {
  // Create a minimal 2-page sample PDF in memory
  const doc = await PDFDocument.create();
  const page1 = doc.addPage([400, 600]);
  page1.drawText("Page 1 Sample Content", { x: 50, y: 500, size: 14, color: rgb(0, 0, 0) });
  const page2 = doc.addPage([400, 600]);
  page2.drawText("Page 2 Sample Content", { x: 50, y: 500, size: 14, color: rgb(0, 0, 0) });
  const initialBytes = await doc.save();

  const stampText = "Licensed to buyer@example.com · Order ord_test123 · INVENTAYU® Books";
  const stampedBytes = await stampPdf(initialBytes, stampText);

  assert.ok(stampedBytes.length > 0, "Stamped output must not be empty");
  assert.ok(stampedBytes.length >= initialBytes.length, "Stamped PDF must be larger or equal to original");

  // Verify stamped PDF can be reloaded and has the same number of pages
  const reloaded = await PDFDocument.load(stampedBytes);
  assert.equal(reloaded.getPageCount(), 2, "Page count must remain identical");

  console.log("PDF stamping test passed");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
