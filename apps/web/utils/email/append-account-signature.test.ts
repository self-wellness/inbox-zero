import { describe, expect, it } from "vitest";
import { appendAccountSignature } from "@/utils/email/append-account-signature";

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
