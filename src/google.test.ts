// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { login, DRIVE_SCOPE } from "./google";
const config = {
  clientId: "example.apps.googleusercontent.com",
  apiKey: "public-browser-key",
  projectNumber: "12345",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function sdk() {
  let callback!: (response: {
    access_token: string;
    expires_in: number;
  }) => void;
  const request = vi.fn();
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        sub: "account-A",
        email: "a@example.com",
        email_verified: true,
      }),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  Object.defineProperty(window, "google", {
    configurable: true,
    value: {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((options) => {
            callback = options.callback;
            return { requestAccessToken: request };
          }),
          hasGrantedAllScopes: vi.fn(() => true),
        },
      },
    },
  });
  return {
    respond: () =>
      callback({ access_token: "memory-only-token", expires_in: 3600 }),
    fetcher,
    request,
  };
}
it("starts Google popup synchronously, then verifies the user with token in a header", async () => {
  const m = sdk();
  const promise = login(config);
  expect(m.request).toHaveBeenCalledWith({ prompt: "select_account" });
  m.respond();
  const user = await promise;
  expect(user.subject).toBe("account-A");
  expect(m.fetcher.mock.calls[0][0]).not.toContain("memory-only-token");
  expect(m.fetcher.mock.calls[0][1].headers.Authorization).toBe(
    "Bearer memory-only-token",
  );
  expect(window.google!.accounts.oauth2.initTokenClient).toHaveBeenCalledWith(
    expect.objectContaining({ scope: `openid email ${DRIVE_SCOPE}` }),
  );
});
it("does not fetch user information if Google answers after cancellation", async () => {
  const m = sdk();
  const controller = new AbortController();
  const promise = login(config, controller.signal);
  const assertion = expect(promise).rejects.toThrow("登入已取消");
  controller.abort();
  m.respond();
  await assertion;
  expect(m.fetcher).not.toHaveBeenCalled();
});
it("refuses a previously canceled login before opening a popup", async () => {
  const m = sdk();
  const controller = new AbortController();
  controller.abort();
  await expect(login(config, controller.signal)).rejects.toThrow("登入已取消");
  expect(m.request).not.toHaveBeenCalled();
});
