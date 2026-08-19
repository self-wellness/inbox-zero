import type { CardElement } from "chat";
import type { EmailAccountWithAI } from "@/utils/llms/types";
import type { Logger } from "@/utils/logger";
import {
  reviseMessagingDraftBody,
  splitDraftBodyAndStoredSignature,
} from "@/utils/ai/reply/revise-messaging-draft";
import {
  draftCardDisplayRecipient,
  loadOpenMessagingDraftCards,
  resolveOpenDraftCardForUserMessage,
} from "@/utils/messaging/open-draft-chat-context";
import {
  buildMessagingDraftRevisionCard,
  updateOpenMessagingDraftFromChat,
} from "@/utils/messaging/rule-notifications";

export type MessagingDraftRevisionResult = {
  actionId: string;
  draftBody: string;
  recipient: string;
  subject: string | null;
  text: string;
  card: CardElement;
};

export async function tryReviseOpenMessagingDraftFromChat({
  emailAccount,
  messageText,
  logger,
}: {
  emailAccount: EmailAccountWithAI;
  messageText: string;
  logger: Logger;
}): Promise<MessagingDraftRevisionResult | null> {
  if (!messageText.trim()) return null;

  const cards = await loadOpenMessagingDraftCards(emailAccount.id);
  const card = resolveOpenDraftCardForUserMessage({
    text: messageText,
    cards,
  });
  if (!card) return null;

  const revised = await reviseMessagingDraftBody({
    currentContent: card.content,
    instruction: messageText,
    emailAccount,
  });
  if (!revised.applied) return null;

  const nextContent = revised.content;

  const updated = await updateOpenMessagingDraftFromChat({
    executedActionId: card.id,
    nextContent,
    logger,
  });
  if (!updated) return null;

  const recipient = draftCardDisplayRecipient({
    ...card,
    to: updated.to || card.to,
    subject: updated.subject || card.subject,
  });
  const subject = updated.subject || card.subject;
  const draftBody = splitDraftBodyAndStoredSignature(nextContent).body;
  const text =
    `Updated the draft to **${recipient}**.\n\n${draftBody}\n\n` +
    "Tap Send reply when it looks right.";

  logger.info("Revised open messaging draft from chat", {
    executedActionId: card.id,
    messageId: card.messageId,
  });

  return {
    actionId: card.id,
    draftBody,
    recipient,
    subject,
    text,
    card: buildMessagingDraftRevisionCard({
      actionId: card.id,
      recipient,
      subject,
      draftBody,
    }),
  };
}
