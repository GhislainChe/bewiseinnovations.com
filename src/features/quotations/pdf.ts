import "server-only";
import { renderQuotationPdf as legacy } from "./pdf-v1";
import { renderQuotationPdf as branded,renderRequestPdf } from "./pdf-v2";
import type { QuoteDocument } from "./model";
export const PDF_TEMPLATE_VERSION=2;
export { renderRequestPdf };
export async function renderQuotationPdf(document:QuoteDocument) {
 if(document.templateVersion===1)return legacy(document);
 if(document.templateVersion===2)return branded(document);
 throw new Error("Unsupported document template.");
}
