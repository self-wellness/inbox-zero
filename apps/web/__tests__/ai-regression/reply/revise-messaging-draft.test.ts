import { describe, expect, test } from "vitest";
import { getEmailAccount } from "@/__tests__/helpers";
import { reviseMessagingDraftBody } from "@/utils/ai/reply/revise-messaging-draft";

const isAiTest = process.env.RUN_AI_TESTS === "true";
const TEST_TIMEOUT = 30_000;

const SIGNATURE_HTML =
  '<div dir="ltr"><div style="color:rgb(0,0,0)"><b>Self.</b></div><div>JULIAN JORGENSEN</div></div>';

const ORIGINAL_DRAFT = [
  "Hi Alex,",
  "",
  "Yes use UPS. My number is +45 53 33 13 49",
  "",
  "Best regards,",
  "Julian",
  "",
  SIGNATURE_HTML,
].join("\n");

describe.runIf(isAiTest)("reviseMessagingDraftBody", () => {
  test(
    "applies a detail change without rewriting the rest of the draft",
    async () => {
      const result = await reviseMessagingDraftBody({
        currentContent: ORIGINAL_DRAFT,
        instruction: "yes but use number +1 909 555 5131",
        emailAccount: getEmailAccount(),
      });

      expect(result.applied).toBe(true);
      expect(result.content).toContain("+1 909 555 5131");
      expect(result.content).not.toContain("+45 53 33 13 49");
      expect(result.content).toMatch(/Hi Alex/i);
      expect(result.content).toMatch(/UPS/i);
      expect(result.content).toMatch(/Best regards/i);
      expect(result.content).toContain("Julian");
      expect(result.content).toContain(SIGNATURE_HTML);
    },
    TEST_TIMEOUT,
  );

  test(
    "does not treat an unrelated inbox question as a draft revision",
    async () => {
      const result = await reviseMessagingDraftBody({
        currentContent: ORIGINAL_DRAFT,
        instruction: "How many unread emails do I have?",
        emailAccount: getEmailAccount(),
      });

      expect(result.applied).toBe(false);
      expect(result.content).toBe(ORIGINAL_DRAFT);
    },
    TEST_TIMEOUT,
  );
});
