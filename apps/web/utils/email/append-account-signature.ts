import { convertNewlinesToBr, escapeHtml } from "@/utils/string";

/**
 * Append the account email signature to a composed body.
 * Matches auto-draft behavior in reply-tracker/generate-draft.ts.
 * Idempotent when the signature is already present at the end.
 */
export function appendAccountSignature(
  body: string,
  signature: string | null | undefined,
): string {
  const sig = signature?.trim();
  if (!sig) return body;

  const normalizedBody = body.trimEnd();
  if (!normalizedBody) return sig;

  if (
    normalizedBody.endsWith(sig) ||
    normalizedBody.includes(`\n\n${sig}`) ||
    normalizedBody.includes(`<br><br>${sig}`)
  ) {
    return body;
  }

  return `${normalizedBody}\n\n${sig}`;
}

/**
 * Telegram/chat send stores the draft as plain text plus a raw HTML signature.
 * Escape only the reply body so the signature still renders.
 */
export function draftContentToMessageHtml(
  content: string,
  signature?: string | null,
): string {
  const sig = signature?.trim() || "";
  let body = content;
  if (sig && body.includes(sig)) {
    body = body.replaceAll(sig, "").trimEnd();
  }

  const htmlBody = convertNewlinesToBr(escapeHtml(body));
  if (!sig) return htmlBody;
  if (htmlBody.endsWith(sig) || htmlBody.includes(`<br><br>${sig}`)) {
    return htmlBody;
  }
  return `${htmlBody}<br><br>${sig}`;
}
