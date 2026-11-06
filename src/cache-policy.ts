/** This callback is serialized into the generated service worker: keep it self-contained. */
export function matchPublicThumbnail({
  url,
  request,
}: {
  url: URL;
  request: Pick<Request, "method" | "destination" | "headers">;
}) {
  return (
    request.method === "GET" &&
    request.destination === "image" &&
    !request.headers.has("authorization") &&
    url.protocol === "https:" &&
    url.hostname === "i.ytimg.com" &&
    !url.search &&
    /^\/vi\/[\w-]{11}\/hqdefault\.jpg$/.test(url.pathname)
  );
}
