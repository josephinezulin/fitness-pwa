import type { Page } from "@playwright/test";
import {
  ALL_TABS,
  HEADERS,
  SCHEMA_KEY,
  SCHEMA_VERSION,
} from "../src/sheet-schema";
import { testSource, TEST_TIME, TEST_ZONE } from "../src/test-fixtures";
import { TODAY } from "./fixtures";

// Fake SDK and read-only HTTP responses only. No real OAuth, Picker or private files.
export async function installGoogleSelectionFixture(page: Page) {
  const id = "fictional-fitness-sheet-A";
  const subject = "fictional-owner-A";
  const token = "fictional-browser-oauth-token-not-real";
  const calls: { method: string; url: string }[] = [];
  const source = testSource();
  const workout: Record<string, string | number> = {
    id: "fictional-cloud-workout",
    date: TODAY,
    timezone: TEST_ZONE,
    type: "yoga",
    minutes: 37,
    calories: 123,
    note: "虛構雲端選表紀錄",
    source: "pwa",
    revision: 1,
    updatedAt: TEST_TIME,
    deletedAt: "",
  };
  source.grids.WorkoutLogs.push(
    HEADERS.WorkoutLogs.map((key) => workout[key] ?? ""),
  );
  await page.route("**/google-config.json", (route) =>
    route.fulfill({
      json: {
        clientId: "fictional.apps.googleusercontent.com",
        apiKey: "AIza" + "F".repeat(30),
        projectNumber: "12345",
      },
    }),
  );
  const sdk = `(() => {
    document.documentElement.dataset.fictionalPickerCount = '0';
    class DocsView {
      setMimeTypes() { return this; } setIncludeFolders() { return this; } setSelectFolderEnabled() { return this; }
    }
    class PickerBuilder {
      setDeveloperKey() { return this; } setAppId() { return this; } setOAuthToken() { return this; }
      setOrigin() { return this; } setLocale() { return this; } setTitle() { return this; } addView() { return this; }
      setCallback(callback) { this.callback = callback; return this; }
      build() {
        const callback = this.callback;
        return { dispose() {}, setVisible(show) {
          if (!show) return;
          document.documentElement.dataset.fictionalPickerCount = String(Number(document.documentElement.dataset.fictionalPickerCount) + 1);
          queueMicrotask(() => callback({ action: 'picked', docs: [{ id: 'fictional-fitness-sheet-A', name: '虛構私人健身表' }] }));
        } };
      }
    }
    window.google = {
      accounts: { oauth2: {
        initTokenClient(config) { return { requestAccessToken() { queueMicrotask(() => config.callback({ access_token: 'fictional-browser-oauth-token-not-real', expires_in: 3600 })); } }; },
        hasGrantedAllScopes() { return true; }, revoke(token, callback) { callback(); }
      } }, picker: { DocsView, PickerBuilder, Action: { PICKED: 'picked', CANCEL: 'cancel' } }
    };
  })();`;
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ contentType: "application/javascript", body: sdk }),
  );
  await page.route("https://apis.google.com/js/api.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "window.gapi = { load(name, options) { options.callback(); } };",
    }),
  );
  await page.route("https://www.googleapis.com/**", async (route) => {
    const request = route.request();
    calls.push({ method: request.method(), url: request.url() });
    if (request.method() !== "GET") return route.abort();
    if (new URL(request.url()).pathname === "/oauth2/v3/userinfo")
      return route.fulfill({
        json: {
          sub: subject,
          email: "owner-a@example.com",
          email_verified: true,
        },
      });
    if (new URL(request.url()).pathname === "/drive/v3/files/" + id)
      return route.fulfill({
        json: {
          id,
          mimeType: "application/vnd.google-apps.spreadsheet",
          ownedByMe: true,
          shared: false,
          capabilities: { canEdit: true },
        },
      });
    return route.abort();
  });
  await page.route(
    "https://sheets.googleapis.com/v4/spreadsheets/**",
    async (route) => {
      const request = route.request();
      calls.push({ method: request.method(), url: request.url() });
      const url = new URL(request.url());
      if (
        request.method() !== "GET" ||
        url.pathname !== "/v4/spreadsheets/" + id
      )
        return route.abort();
      if (url.searchParams.get("includeGridData") === "true")
        return route.fulfill({
          json: {
            sheets: ALL_TABS.map((tab) => ({
              properties: { title: tab },
              data: [
                {
                  rowData: source.grids[tab]!.map((row) => ({
                    values: row.map((value) => ({
                      userEnteredValue:
                        typeof value === "number"
                          ? { numberValue: value }
                          : typeof value === "boolean"
                            ? { boolValue: value }
                            : { stringValue: value ?? "" },
                    })),
                  })),
                },
              ],
            })),
          },
        });
      return route.fulfill({
        json: {
          spreadsheetId: id,
          properties: { title: "虛構私人健身表", timeZone: TEST_ZONE },
          developerMetadata: [
            {
              metadataKey: SCHEMA_KEY,
              metadataValue: SCHEMA_VERSION,
              location: { spreadsheet: true },
            },
          ],
          sheets: ALL_TABS.map((tab, sheetId) => ({
            properties: {
              sheetId,
              title: tab,
              gridProperties: {
                rowCount: 1000,
                columnCount: HEADERS[tab].length,
              },
            },
          })),
        },
      });
    },
  );
  return { id, subject, token, calls };
}
