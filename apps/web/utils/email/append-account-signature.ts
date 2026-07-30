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
