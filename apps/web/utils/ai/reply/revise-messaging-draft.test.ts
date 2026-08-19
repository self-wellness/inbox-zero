import { describe, expect, it } from "vitest";
import {
  joinDraftBodyAndStoredSignature,
  splitDraftBodyAndStoredSignature,
} from "./revise-messaging-draft";

const SIGNATURE_HTML =
  '<div dir="ltr"><div style="color:rgb(0,0,0)"><b>Self.</b></div></div>';

describe("splitDraftBodyAndStoredSignature", () => {
  it("keeps the visible sign-off and peels off stored HTML signature", () => {
    const content = [
      "Hi Alex,",
      "",
      "Yes use UPS. My number is +45 53 33 13 49",
      "",
      "Best regards,",
      "Julian",
      "",
      SIGNATURE_HTML,
    ].join("\n");

    expect(splitDraftBodyAndStoredSignature(content)).toEqual({
      body: [
        "Hi Alex,",
        "",
        "Yes use UPS. My number is +45 53 33 13 49",
        "",
        "Best regards,",
        "Julian",
      ].join("\n"),
      storedSignature: SIGNATURE_HTML,
    });
  });

  it("returns the full text when there is no stored HTML signature", () => {
    expect(
      splitDraftBodyAndStoredSignature("Hi Alex,\n\nYes use UPS."),
    ).toEqual({
      body: "Hi Alex,\n\nYes use UPS.",
      storedSignature: "",
    });
  });
});

describe("joinDraftBodyAndStoredSignature", () => {
  it("reattaches the original HTML signature after a surgical edit", () => {
    expect(
      joinDraftBodyAndStoredSignature(
        "Hi Alex,\n\nYes use UPS. My number is +1 909 555 5131\n\nBest regards,\nJulian",
        SIGNATURE_HTML,
      ),
    ).toBe(
      [
        "Hi Alex,",
        "",
        "Yes use UPS. My number is +1 909 555 5131",
        "",
        "Best regards,",
        "Julian",
        "",
        SIGNATURE_HTML,
      ].join("\n"),
    );
  });
});
