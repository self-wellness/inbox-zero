import type { ModelMessage } from "ai";
import { ActionType, MessagingMessageStatus } from "@/generated/prisma/enums";
import { extractEmailAddress, extractNameFromEmail } from "@/utils/email";
import { convertEmailHtmlToText } from "@/utils/mail";
import prisma from "@/utils/prisma";
import { stripQuotedContent } from "@/utils/ai/choose-rule/draft-management";

export type OpenMessagingDraftCard = {
  id: string;
  content: string;
  messageId: string;
  threadId: string;
  to: string | null;
  subject: string | null;
  sentAt: Date | null;
};

const REVISION_REQUEST_REGEX =
  /^(change|rewrite|update|edit|revise)\b|\b(change|rewrite|update|edit) (this|the draft|it|to)\b|\bkeep my signature\b|\bmake it (say|read)\b|\buse the original draft\b/i;

export async function loadOpenMessagingDraftCards(
  emailAccountId: string,
): Promise<OpenMessagingDraftCard[]> {
  const rows = await prisma.executedAction.findMany({
    where: {
      type: ActionType.DRAFT_MESSAGING_CHANNEL,
      messagingMessageStatus: {
        in: [MessagingMessageStatus.SENT, MessagingMessageStatus.DRAFT_EDITED],
      },
      executedRule: { emailAccountId },
    },
    orderBy: [{ messagingMessageSentAt: "desc" }, { createdAt: "desc" }],
    take: 5,
    select: {
      id: true,
      content: true,
      to: true,
      subject: true,
      messagingMessageSentAt: true,
      executedRule: {
        select: {
          messageId: true,
          threadId: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    content: row.content || "",
    messageId: row.executedRule.messageId,
    threadId: row.executedRule.threadId,
    to: row.to,
    subject: row.subject,
    sentAt: row.messagingMessageSentAt,
  }));
}

export function draftCardDisplayRecipient(
  card: OpenMessagingDraftCard,
): string {
  if (card.to?.trim()) {
    return (
      extractNameFromEmail(card.to) ||
      extractEmailAddress(card.to) ||
      card.to.trim()
    );
  }

  const greeting = card.content.match(
    /^(?:hi|hello|hey|dear)\s+([^,\n]+)/i,
  )?.[1];
  return greeting?.trim() || "this draft";
}

export function buildOpenDraftCardsContextMessage(
  cards: OpenMessagingDraftCard[],
): ModelMessage | null {
  if (cards.length === 0) return null;

  const newest = cards[0];
  const lines = cards.map((card, index) => {
    const body = stripDraftBodyForContext(card.content);
    const recipient = draftCardDisplayRecipient(card);
    const subject = card.subject?.trim() || "(no subject)";
    const recency = index === 0 ? "MOST RECENT — bind 'this draft' here" : "";
    return [
      `${index + 1}. To: ${recipient}${card.to ? ` <${extractEmailAddress(card.to) || card.to}>` : ""}`,
      `   Subject: ${subject}`,
      `   messageId: ${card.messageId}`,
      `   threadId: ${card.threadId}`,
      recency ? `   ${recency}` : null,
      `   Current draft:\n${body}`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return {
    role: "user",
    content:
      "[Automated] Open chat draft cards (not yet sent or dismissed). " +
      "These are what the user is looking at in Telegram/Slack. " +
      "Chat history may mention older threads — do not reuse those messageIds " +
      "unless the user names that recipient. " +
      `If they say "this", "the draft", "change this", or similar without naming ` +
      `someone else, you MUST use messageId ${newest.messageId} ` +
      `(${draftCardDisplayRecipient(newest)}). ` +
      "Do not show these IDs to the user.\n\n" +
      lines.join("\n\n"),
  };
}

export function isMessagingDraftRevisionRequest(text: string): boolean {
  return REVISION_REQUEST_REGEX.test(text.trim());
}

export function resolveOpenDraftCardForUserMessage({
  text,
  cards,
}: {
  text: string;
  cards: OpenMessagingDraftCard[];
}): OpenMessagingDraftCard | null {
  if (cards.length === 0) return null;

  const haystack = text.toLowerCase();
  const named = cards.filter((card) => cardMatchesUserText(card, haystack));

  if (named.length === 1) return named[0];
  if (named.length > 1) return named[0];

  const mentionsUnlistedRecipient =
    /\b(?:to|for|reply(?:ing)? to)\s+[A-Z][a-z]{2,}\b/.test(text);
  if (mentionsUnlistedRecipient && !isMessagingDraftRevisionRequest(text)) {
    return null;
  }

  return cards[0];
}

function cardMatchesUserText(
  card: OpenMessagingDraftCard,
  haystack: string,
): boolean {
  const tokens = new Set<string>();

  if (card.to) {
    const name = extractNameFromEmail(card.to).toLowerCase();
    const email = extractEmailAddress(card.to).toLowerCase();
    for (const part of name.split(/\s+/)) {
      if (part.length >= 3) tokens.add(part);
    }
    if (email) tokens.add(email);
    const local = email.split("@")[0];
    if (local && local.length >= 3) tokens.add(local);
  }

  const greeting = card.content.match(
    /^(?:hi|hello|hey|dear)\s+([^,\n]+)/i,
  )?.[1];
  if (greeting) {
    for (const part of greeting.toLowerCase().split(/\s+/)) {
      if (part.length >= 3) tokens.add(part);
    }
  }

  return [...tokens].some((token) => haystack.includes(token));
}

function stripDraftBodyForContext(content: string): string {
  const withoutQuote = stripQuotedContent(content);
  if (!withoutQuote.includes("<")) return withoutQuote.slice(0, 800);

  return convertEmailHtmlToText({
    htmlText: withoutQuote.replace(/\n/g, "<br>"),
    includeLinks: false,
  }).slice(0, 800);
}
