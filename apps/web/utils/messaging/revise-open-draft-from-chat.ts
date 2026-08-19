import type { EmailAccountWithAI } from "@/utils/llms/types";
import type { Logger } from "@/utils/logger";
import { reviseMessagingDraftBody } from "@/utils/ai/reply/revise-messaging-draft";
import {
  draftCardDisplayRecipient,
  loadOpenMessagingDraftCards,
  resolveOpenDraftCardForUserMessage,
} from "@/utils/messaging/open-draft-chat-context";
import { updateOpenMessagingDraftFromChat } from "@/utils/messaging/rule-notifications";

export async function tryReviseOpenMessagingDraftFromChat({
  emailAccount,
  messageText,
  logger,
}: {
  emailAccount: EmailAccountWithAI;
  messageText: string;
  logger: Logger;
}): Promise<string | null> {
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

  logger.info("Revised open messaging draft from chat", {
    executedActionId: card.id,
    messageId: card.messageId,
  });

  return `Updated the draft to **${recipient}**. Tap Send reply on that card when it looks right.`;
}
