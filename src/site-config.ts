import type { GoogleConfig } from "./google";

/** Public application identifiers, supplied once by the website maintainer. Never user tokens. */
export function parseSiteConfig(raw: unknown): GoogleConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error("網站連線設定格式不符。");
  const record = raw as Record<string, unknown>;
  const fields = ["clientId", "apiKey", "projectNumber"] as const;
  if (
    Object.keys(record).some(
      (key) => !fields.includes(key as (typeof fields)[number]),
    )
  )
    throw Error("網站連線設定含未允許的欄位。");
  if (fields.some((key) => typeof record[key] !== "string"))
    throw Error("網站連線設定不完整。");
  const c = Object.fromEntries(
    fields.map((key) => [key, (record[key] as string).trim()]),
  ) as GoogleConfig;
  if (fields.every((key) => c[key] === "")) return null;
  if (
    !/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(c.clientId) ||
    !/^AIza[\w-]{20,}$/.test(c.apiKey) ||
    !/^\d{5,}$/.test(c.projectNumber)
  )
    throw Error("網站連線設定尚未完成。");
  return c;
}
export async function loadSiteConfig(
  url: URL,
  signal: AbortSignal,
): Promise<GoogleConfig | null> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "omit",
    signal,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw Error("暫時無法確認 Google 連線，請稍後重試。");
  return parseSiteConfig(await response.json());
}
