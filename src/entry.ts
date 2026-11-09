/** How the user enters the app: signed in with Google, or browsing this device only. */
export type EntryMode = "google" | "local";
export const ENTRY_KEY = "daily-movement-entry-v1";
export const ACCOUNT_KEY = "daily-movement-last-account-v1";

export function readEntry(storage: Pick<Storage, "getItem">): EntryMode | null {
  try {
    const value = storage.getItem(ENTRY_KEY);
    return value === "google" || value === "local" ? value : null;
  } catch {
    return null;
  }
}
export function writeEntry(storage: Pick<Storage, "setItem">, mode: EntryMode) {
  try {
    storage.setItem(ENTRY_KEY, mode);
  } catch {
    // Storage may be unavailable (private mode); the choice simply is not remembered.
  }
}
/** Only the email is kept, to label the one-tap "continue" button. No token is stored. */
export function rememberAccount(
  storage: Pick<Storage, "setItem">,
  email: string,
) {
  try {
    if (email) storage.setItem(ACCOUNT_KEY, email.slice(0, 320));
  } catch {
    // Ignore: the welcome screen falls back to a generic sign-in button.
  }
}
/** Local-only profile from first-time setup. Health data itself lives in the workspace. */
export type Profile = { onboarded: boolean; nickname: string };
export const PROFILE_KEY = "daily-movement-profile-v1";
export function readProfile(storage: Pick<Storage, "getItem">): Profile {
  try {
    const raw = JSON.parse(storage.getItem(PROFILE_KEY) || "null");
    return {
      onboarded: raw?.onboarded === true,
      nickname:
        typeof raw?.nickname === "string" ? raw.nickname.slice(0, 20) : "",
    };
  } catch {
    return { onboarded: false, nickname: "" };
  }
}
export function writeProfile(
  storage: Pick<Storage, "setItem">,
  profile: Profile,
) {
  try {
    storage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        onboarded: profile.onboarded,
        nickname: profile.nickname.trim().slice(0, 20),
      }),
    );
  } catch {
    // Without storage the setup simply shows again next time.
  }
}
export function readAccount(storage: Pick<Storage, "getItem">): string {
  try {
    return storage.getItem(ACCOUNT_KEY) || "";
  } catch {
    return "";
  }
}
