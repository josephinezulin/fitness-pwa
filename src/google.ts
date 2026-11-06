// All credentials remain in this module's live session. Nothing writes tokens to storage.
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export type GoogleConfig = {
  clientId: string;
  apiKey: string;
  projectNumber: string;
};
export type GoogleSession = {
  accessToken: string;
  expiresAt: number;
  subject: string;
  email: string;
};
type TokenResponse = {
  access_token: string;
  expires_in: number;
  error?: string;
  scope?: string;
};
type TokenClient = { requestAccessToken(options: { prompt: string }): void };
type PickerResult = {
  action: string;
  docs?: { id: string; name?: string; mimeType?: string }[];
};
type PickerView = {
  setMimeTypes(value: string): PickerView;
  setIncludeFolders(value: boolean): PickerView;
  setSelectFolderEnabled(value: boolean): PickerView;
};
type PickerBuilder = {
  setDeveloperKey(value: string): PickerBuilder;
  setAppId(value: string): PickerBuilder;
  setOAuthToken(value: string): PickerBuilder;
  setOrigin(value: string): PickerBuilder;
  setLocale(value: string): PickerBuilder;
  setTitle(value: string): PickerBuilder;
  addView(value: PickerView): PickerBuilder;
  setCallback(value: (result: PickerResult) => void): PickerBuilder;
  build(): { setVisible(value: boolean): void; dispose(): void };
};
type GoogleSdk = {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        include_granted_scopes: boolean;
        callback: (result: TokenResponse) => void;
        error_callback: () => void;
      }): TokenClient;
      hasGrantedAllScopes(result: TokenResponse, scope: string): boolean;
      revoke(token: string, callback: () => void): void;
    };
  };
  picker: {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new () => PickerView;
    Action: { PICKED: string; CANCEL: string };
  };
};
declare global {
  interface Window {
    google?: GoogleSdk;
    gapi?: {
      load(
        name: string,
        options: {
          callback: () => void;
          onerror: () => void;
          timeout: number;
          ontimeout: () => void;
        },
      ): void;
    };
  }
}
const scripts = new Map<string, Promise<void>>();
function script(src: string) {
  if (!scripts.has(src)) {
    const promise = new Promise<void>((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = true;
      const timer = window.setTimeout(() => {
        el.remove();
        reject(Error("Google 元件載入逾時，請檢查網路後重試。"));
      }, 20000);
      el.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      el.onerror = () => {
        clearTimeout(timer);
        el.remove();
        reject(Error("無法載入 Google 元件，請檢查網路或內容阻擋器。"));
      };
      document.head.appendChild(el);
    }).catch((error) => {
      scripts.delete(src);
      throw error;
    });
    scripts.set(src, promise);
  }
  return scripts.get(src)!;
}
export async function prepareGoogle() {
  await Promise.all([
    script("https://accounts.google.com/gsi/client"),
    script("https://apis.google.com/js/api.js"),
  ]);
  if (!window.gapi || !window.google?.accounts)
    throw Error("Google 元件未就緒。");
  await new Promise<void>((resolve, reject) =>
    window.gapi!.load("picker", {
      callback: resolve,
      onerror: () => reject(Error("無法載入 Google 選檔器。")),
      timeout: 15000,
      ontimeout: () => reject(Error("Google 選檔器逾時。")),
    }),
  );
}
export function login(config: GoogleConfig): Promise<GoogleSession> {
  // Called directly from a click after prepareGoogle: keep the popup in Safari's user gesture.
  return new Promise((resolve, reject) => {
    const sdk = window.google;
    if (!sdk?.accounts) {
      reject(Error("請先載入 Google 連線元件。"));
      return;
    }
    const client = sdk.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: `openid email ${DRIVE_SCOPE}`,
      include_granted_scopes: false,
      error_callback: () => reject(Error("登入視窗已關閉或被阻擋，請重試。")),
      callback: (response) => {
        if (
          response.error ||
          !response.access_token ||
          !Number.isFinite(Number(response.expires_in)) ||
          Number(response.expires_in) <= 60 ||
          !sdk.accounts.oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)
        ) {
          reject(Error("未取得選定試算表的必要授權。"));
          return;
        }
        const accessToken = response.access_token;
        fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          credentials: "omit",
        })
          .then(async (r) => {
            if (!r.ok) throw Error("無法確認 Google 帳號，請重新登入。");
            return r.json() as Promise<{
              sub?: string;
              email?: string;
              email_verified?: boolean;
            }>;
          })
          .then((user) => {
            if (!user.sub || !user.email || !user.email_verified)
              throw Error("Google 帳號資訊不完整。");
            resolve({
              accessToken,
              subject: user.sub,
              email: user.email,
              expiresAt:
                Date.now() +
                Math.max(0, Number(response.expires_in) - 60) * 1000,
            });
          })
          .catch(() =>
            reject(Error("無法確認 Google 帳號，請檢查網路後重新登入。")),
          );
      },
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
}
export function chooseSpreadsheet(
  config: GoogleConfig,
  session: GoogleSession,
  signal: AbortSignal,
): Promise<{ id: string; title: string } | null> {
  return new Promise((resolve, reject) => {
    if (Date.now() >= session.expiresAt) {
      reject(Error("Google 授權已過期，請重新登入。"));
      return;
    }
    const sdk = window.google;
    if (!sdk?.picker) {
      reject(Error("Google 選檔器尚未就緒。"));
      return;
    }
    let picker: ReturnType<PickerBuilder["build"]> | undefined;
    const finish = (result: { id: string; title: string } | null) => {
      signal.removeEventListener("abort", cancel);
      picker?.dispose();
      resolve(result);
    };
    const cancel = () => finish(null);
    if (signal.aborted) {
      resolve(null);
      return;
    }
    signal.addEventListener("abort", cancel, { once: true });
    try {
      picker = new sdk.picker.PickerBuilder()
        .setDeveloperKey(config.apiKey)
        .setAppId(config.projectNumber)
        .setOAuthToken(session.accessToken)
        .setOrigin(window.location.origin)
        .setLocale("zh-TW")
        .setTitle("選擇你自己的健身試算表副本")
        .addView(
          new sdk.picker.DocsView()
            .setMimeTypes("application/vnd.google-apps.spreadsheet")
            .setIncludeFolders(false)
            .setSelectFolderEnabled(false),
        )
        .setCallback((result) => {
          if (result.action === sdk.picker.Action.CANCEL) finish(null);
          if (result.action === sdk.picker.Action.PICKED && result.docs?.[0]) {
            const doc = result.docs[0];
            if (!/^[a-zA-Z0-9_-]+$/.test(doc.id)) {
              finish(null);
              return;
            }
            finish({ id: doc.id, title: doc.name || "健身試算表" });
          }
        })
        .build();
      picker.setVisible(true);
    } catch {
      signal.removeEventListener("abort", cancel);
      picker?.dispose();
      reject(Error("無法開啟選檔器，請確認 API Key、專案編號與網站限制。"));
    }
  });
}
export function revoke(session: GoogleSession) {
  window.google?.accounts.oauth2.revoke(session.accessToken, () => {});
}
