import { z } from "zod";
import { createGenerateObject } from "@/utils/llms/index";
import { getModelForUseCase, LlmUseCase } from "@/utils/llms/use-cases";
import type { EmailAccountWithAI } from "@/utils/llms/types";
import { convertEmailHtmlToText } from "@/utils/mail";
import { stripQuotedContent } from "@/utils/ai/choose-rule/draft-management";

const reviseSchema = z.object({
  isRevision: z.boolean(),
  body: z.string(),
});

export type RevisedMessagingDraft = {
  applied: boolean;
  content: string;
};

const STORED_SIGNATURE_SPLIT_REGEX = /\n\s*(<(?:div|table|span)\b[\s\S]*)$/i;

export function splitDraftBodyAndStoredSignature(content: string): {
  body: string;
  storedSignature: string;
} {
  const withoutQuote = stripQuotedContent(content);
  const match = withoutQuote.match(STORED_SIGNATURE_SPLIT_REGEX);
  if (match?.index != null) {
    return {
      body: normalizeDraftBody(withoutQuote.slice(0, match.index)),
      storedSignature: match[1].trim(),
    };
  }

  return { body: normalizeDraftBody(withoutQuote), storedSignature: "" };
}

export function joinDraftBodyAndStoredSignature(
  body: string,
  storedSignature: string,
): string {
  let nextBody = body.trimEnd();
  if (storedSignature && nextBody.includes(storedSignature)) {
    nextBody = nextBody.replaceAll(storedSignature, "").trimEnd();
  }
  if (!storedSignature) return nextBody;
  return `${nextBody}\n\n${storedSignature}`;
}

export async function reviseMessagingDraftBody({
  currentContent,
  instruction,
  emailAccount,
}: {
  currentContent: string;
  instruction: string;
  emailAccount: EmailAccountWithAI;
}): Promise<RevisedMessagingDraft> {
  const { body: currentBody, storedSignature } =
    splitDraftBodyAndStoredSignature(currentContent);
  const modelOptions = getModelForUseCase(
    emailAccount.user,
    LlmUseCase.DraftReply,
  );
  const generateObject = createGenerateObject({
    emailAccount,
    label: "Revise messaging draft",
    modelOptions,
    promptHardening: {
      trust: "untrusted",
      level: "full",
      outputConstraint: "plain-text",
    },
  });

  const result = await generateObject({
    ...modelOptions,
    system: `You apply user feedback to an email draft they are already reviewing in chat.

Default: make the smallest possible change. Keep the greeting, sentences, wording, line breaks, sign-off, and name exactly as they are unless the user asked to change that part.
Do not rewrite for style. Do not add a new greeting or closing. Do not remove or replace the sign-off or signature.
If they clearly ask to replace the whole message, replace only the message body and still keep any existing sign-off unless they asked to remove it.
A stored HTML signature is reattached automatically — never copy, rewrite, or omit it.

If the latest user message is not feedback on this draft (inbox question, a different person, or an unrelated request), set isRevision to false and return the current body unchanged.`,
    prompt: `Current draft:
<draft>
${currentBody}
</draft>

User message:
<instruction>
${instruction}
</instruction>`,
    schema: reviseSchema,
  });

  if (!result.object.isRevision) {
    return { applied: false, content: currentContent };
  }

  const nextBody = result.object.body.trim();
  if (!nextBody) {
    throw new Error("Revised draft body was empty");
  }

  return {
    applied: true,
    content: joinDraftBodyAndStoredSignature(nextBody, storedSignature),
  };
}

function normalizeDraftBody(content: string): string {
  if (!content.includes("<")) return content.trim();

  return convertEmailHtmlToText({
    htmlText: content.replace(/\n/g, "<br>"),
    includeLinks: false,
  }).trim();
}
