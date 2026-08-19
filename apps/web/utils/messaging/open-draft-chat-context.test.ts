import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/utils/prisma");
import {
  buildOpenDraftCardsContextMessage,
  draftCardDisplayRecipient,
  isMessagingDraftRevisionRequest,
  resolveOpenDraftCardForUserMessage,
  type OpenMessagingDraftCard,
} from "./open-draft-chat-context";

function card(
  overrides: Partial<OpenMessagingDraftCard> &
    Pick<OpenMessagingDraftCard, "id" | "messageId">,
): OpenMessagingDraftCard {
  return {
    content: "",
    threadId: `thread-${overrides.id}`,
    to: null,
    subject: null,
    sentAt: new Date(),
    ...overrides,
  };
}

describe("isMessagingDraftRevisionRequest", () => {
  it("matches the typed Telegram edit that sent to the wrong person", () => {
    expect(
      isMessagingDraftRevisionRequest(
        "Change to this is a test but keep my signature and all",
      ),
    ).toBe(true);
  });

  it("does not treat a shipping preference as a draft rewrite", () => {
    expect(isMessagingDraftRevisionRequest("Send with PostNord is fine")).toBe(
      false,
    );
  });
});

describe("resolveOpenDraftCardForUserMessage", () => {
  const johan = card({
    id: "johan",
    messageId: "msg-johan",
    content: "Hi Johan,\n\nYou can use my phone number.",
    to: "Johan Beskow <johan.m.beskow@devinsense.com>",
    subject: "Re: Duo 3",
  });
  const alex = card({
    id: "alex",
    messageId: "msg-alex",
    content: "Hi Alex,\n\nYes, this works on my end.",
    to: "Alex Test <alex.iz.test@gmail.com>",
    subject: "[IZ TEST] Signature color check",
  });

  it("binds an unnamed 'change this' edit to the newest open card", () => {
    expect(
      resolveOpenDraftCardForUserMessage({
        text: "Change to this is a test but keep my signature and all",
        cards: [alex, johan],
      })?.id,
    ).toBe("alex");
  });

  it("binds a detail correction to the newest open card", () => {
    expect(
      resolveOpenDraftCardForUserMessage({
        text: "yes but use number +1 909 555 5131",
        cards: [alex, johan],
      })?.id,
    ).toBe("alex");
  });

  it("binds a named recipient even when they are not newest", () => {
    expect(
      resolveOpenDraftCardForUserMessage({
        text: "Change the Johan draft to mention PostNord",
        cards: [alex, johan],
      })?.id,
    ).toBe("johan");
  });
});

describe("buildOpenDraftCardsContextMessage", () => {
  it("forces replyEmail onto the newest card messageId", () => {
    const message = buildOpenDraftCardsContextMessage([
      card({
        id: "alex",
        messageId: "msg-alex",
        to: "Alex Test <alex.iz.test@gmail.com>",
        subject: "Signature color check",
        content: "Hi Alex,\n\nYes, this works.",
      }),
      card({
        id: "johan",
        messageId: "msg-johan",
        to: "Johan Beskow <johan@example.com>",
        content: "Hi Johan,\n\nPhone number.",
      }),
    ]);

    expect(message?.content).toContain("messageId msg-alex");
    expect(message?.content).toContain("MOST RECENT");
    expect(message?.content).toContain("Alex Test");
  });

  it("returns null when there are no open cards", () => {
    expect(buildOpenDraftCardsContextMessage([])).toBeNull();
  });
});

describe("draftCardDisplayRecipient", () => {
  it("falls back to the greeting when to is empty", () => {
    expect(
      draftCardDisplayRecipient(
        card({
          id: "1",
          messageId: "m",
          content: "Hi Alex,\n\nYes.",
        }),
      ),
    ).toBe("Alex");
  });
});
