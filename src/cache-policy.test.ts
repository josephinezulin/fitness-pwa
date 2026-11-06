import { describe, expect, it } from "vitest";
import { matchPublicThumbnail } from "./cache-policy";
const request = {
  method: "GET",
  destination: "image" as RequestDestination,
  headers: new Headers(),
};
describe("public thumbnail cache boundary", () => {
  it("accepts only the public image shape used by the app", () => {
    expect(
      matchPublicThumbnail({
        url: new URL("https://i.ytimg.com/vi/v7AYKMP6rOE/hqdefault.jpg"),
        request,
      }),
    ).toBe(true);
  });
  it("refuses health, OAuth, Sheets, Apps Script and video-player requests", () => {
    for (const address of [
      "https://sheets.googleapis.com/v4/spreadsheets/private",
      "https://accounts.google.com/o/oauth2/auth",
      "https://script.google.com/macros/s/private/exec",
      "https://www.youtube-nocookie.com/embed/v7AYKMP6rOE",
      "https://i.ytimg.com.example.com/vi/v7AYKMP6rOE/hqdefault.jpg",
      "http://i.ytimg.com/vi/v7AYKMP6rOE/hqdefault.jpg",
      "https://i.ytimg.com/vi/v7AYKMP6rOE/hqdefault.jpg?token=not-real",
    ])
      expect(matchPublicThumbnail({ url: new URL(address), request })).toBe(
        false,
      );
  });
  it("refuses authorized requests and non-image or write requests even at the image URL", () => {
    const url = new URL("https://i.ytimg.com/vi/v7AYKMP6rOE/hqdefault.jpg");
    expect(
      matchPublicThumbnail({
        url,
        request: {
          ...request,
          headers: new Headers({ Authorization: "Bearer test-only" }),
        },
      }),
    ).toBe(false);
    expect(
      matchPublicThumbnail({ url, request: { ...request, destination: "" } }),
    ).toBe(false);
    expect(
      matchPublicThumbnail({ url, request: { ...request, method: "POST" } }),
    ).toBe(false);
  });
});
