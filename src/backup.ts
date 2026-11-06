import { validate, type Data } from "./model";
import { validateLibrary, type VideoLibrary } from "./videos";

export function makeBackup(data: Data, library?: VideoLibrary) {
  return {
    ...validate(data),
    ...(library ? { videoLibrary: validateLibrary(library) } : {}),
  };
}
/** Earlier exports used videos for a local library; accept both formats without losing cloud videos. */
export function parseBackup(raw: unknown) {
  const input = raw as Record<string, unknown>;
  if (!input || typeof input !== "object") throw Error("備份格式錯誤");
  const legacyLibrary =
    input.videos !== undefined && !Array.isArray(input.videos);
  const library =
    input.videoLibrary ?? (legacyLibrary ? input.videos : undefined);
  return {
    data: validate(legacyLibrary ? { ...input, videos: undefined } : input),
    library: library === undefined ? null : validateLibrary(library),
  };
}
