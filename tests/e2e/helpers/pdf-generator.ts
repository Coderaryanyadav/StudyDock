/**
 * Helper to generate a valid, extractable PDF binary buffer for E2E tests
 */
export function generateE2ETestPdfBuffer(pages: { chapter?: string; section?: string; text: string }[]): Buffer {
  let objects = "";
  const pageObjIds: number[] = [];
  let currentObjId = 3;

  for (let i = 0; i < pages.length; i++) {
    const pageData = pages[i];
    const streamContent = `BT /F1 12 Tf 72 712 Td (${pageData.text.replace(/[()\\]/g, "\\$&")}) Tj ET`;
    const streamLen = Buffer.byteLength(streamContent, "utf-8");

    const contentObjId = currentObjId++;
    const pageObjId = currentObjId++;
    pageObjIds.push(pageObjId);

    objects += `${contentObjId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
    objects += `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj\n`;
  }

  const catalogObj = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`;

  const body = `%PDF-1.4\n${catalogObj}${pagesObj}${objects}`;
  const xrefOffset = Buffer.byteLength(body, "utf-8");
  const trailer = `xref\n0 ${currentObjId}\n0000000000 65535 f \ntrailer\n<< /Size ${currentObjId} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(`${body}${trailer}`, "utf-8");
}
