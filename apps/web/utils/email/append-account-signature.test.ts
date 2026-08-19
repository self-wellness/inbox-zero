import { describe, expect, it } from "vitest";
import {
  appendAccountSignature,
  draftContentToMessageHtml,
  wrapAccountSignatureHtml,
} from "@/utils/email/append-account-signature";

describe("appendAccountSignature", () => {
  const signature =
    '<div><b>Self.</b></div><div>JULIAN JORGENSEN</div><div><a href="https://self.io">Self.io</a></div>';

  it("appends the signature after the body", () => {
    expect(appendAccountSignature("Hi Julian,\n\nThis is a test.", signature))
      .toBe(`Hi Julian,\n\nThis is a test.\n\n${signature}`);
  });

  it("returns the body unchanged when signature is empty", () => {
    expect(appendAccountSignature("Hello", null)).toBe("Hello");
    expect(appendAccountSignature("Hello", "  ")).toBe("Hello");
  });

  it("does not double-append when signature is already present", () => {
    const once = appendAccountSignature("Thanks", signature);
    expect(appendAccountSignature(once, signature)).toBe(once);
  });
});

describe("draftContentToMessageHtml", () => {
  const signature =
    '<div><b>Self.</b></div><div>JULIAN JORGENSEN</div><div><a href="https://self.io">Self.io</a></div>';

  it("escapes the reply body and keeps signature HTML renderable", () => {
    const html = draftContentToMessageHtml(
      `Yes, Tuesday still works.\n\n${signature}`,
      signature,
    );

    expect(html).toContain("Yes, Tuesday still works.");
    expect(html).toContain("<br><br>");
    expect(html).toContain('class="gmail_signature"');
    expect(html).toContain('data-smartmail="gmail_signature"');
    expect(html).toContain('x-apple-data-detectors="false"');
    expect(html).toContain('<div><b>Self.</b></div>');
    expect(html).toContain('<a href="https://self.io">Self.io</a>');
    expect(html).not.toContain("&lt;div");
  });

  it("escapes HTML that belongs to the reply, not the signature", () => {
    const html = draftContentToMessageHtml(
      `See <script>alert(1)</script>\n\n${signature}`,
      signature,
    );

    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<b>Self.</b>");
  });
});

describe("wrapAccountSignatureHtml", () => {
  it("wraps a bare signature so clients treat it as a signature block", () => {
    const wrapped = wrapAccountSignatureHtml("<div>JULIAN JORGENSEN</div>");
    expect(wrapped).toBe(
      '<div class="gmail_signature" data-smartmail="gmail_signature" x-apple-data-detectors="false"><div>JULIAN JORGENSEN</div></div>',
    );
  });

  it("does not wrap a signature that is already marked", () => {
    const existing =
      '<div class="gmail_signature" data-smartmail="gmail_signature">Self.</div>';
    expect(wrapAccountSignatureHtml(existing)).toBe(existing);
  });
});
