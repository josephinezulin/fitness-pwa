import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSiteConfig, parseSiteConfig } from "./site-config";
const config = {
  clientId: "1234567890-example.apps.googleusercontent.com",
  apiKey: "AIza" + "x".repeat(25),
  projectNumber: "1234567890",
};
afterEach(() => vi.unstubAllGlobals());
describe("maintainer-owned public Google configuration", () => {
  it("treats an empty deployment as not yet connected, without asking users for keys", () => {
    expect(
      parseSiteConfig({ clientId: "", apiKey: "", projectNumber: "" }),
    ).toBeNull();
  });
  it("accepts the three public identifiers and rejects token or secret fields", () => {
    expect(parseSiteConfig(config)).toEqual(config);
    expect(() =>
      parseSiteConfig({ ...config, accessToken: "should-never-be-public" }),
    ).toThrow("未允許");
    expect(() =>
      parseSiteConfig({ ...config, clientSecret: "should-never-be-public" }),
    ).toThrow("未允許");
  });
  it("rejects partial and invalid configurations", () => {
    expect(() => parseSiteConfig({ ...config, clientId: "" })).toThrow();
    expect(() =>
      parseSiteConfig({ ...config, projectNumber: "my-project-name" }),
    ).toThrow();
    expect(() => parseSiteConfig(null)).toThrow();
  });
  it("loads site configuration without reading personal browser settings or sending credentials", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(config)));
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal(
      "localStorage",
      new Proxy(
        {},
        {
          get() {
            throw Error("Must not read browser keys");
          },
        },
      ),
    );
    const url = new URL("https://example.com/fitness-pwa/google-config.json");
    expect(await loadSiteConfig(url, new AbortController().signal)).toEqual(
      config,
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      credentials: "omit",
      cache: "no-store",
    });
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty("headers");
  });
  it("leaves Google login unavailable when the deployment has no configuration file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 404 })),
    );
    expect(
      await loadSiteConfig(
        new URL("https://example.com/google-config.json"),
        new AbortController().signal,
      ),
    ).toBeNull();
  });
});
