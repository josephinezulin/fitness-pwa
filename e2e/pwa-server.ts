import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";

/** Isolated loopback server: serve dist, changing only the test SW response. */
export async function startPwaUpgradeServer() {
  const root = resolve("dist");
  let version = 1;
  const types: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (
        request.method !== "GET" ||
        !url.pathname.startsWith("/fitness-pwa/")
      ) {
        response.writeHead(404).end();
        return;
      }
      const path = resolve(
        root,
        decodeURIComponent(url.pathname.slice("/fitness-pwa/".length)) ||
          "index.html",
      );
      if (!path.startsWith(root + sep)) {
        response.writeHead(404).end();
        return;
      }
      let content = await readFile(path);
      if (path === resolve(root, "sw.js")) {
        // Test-only identity; never alter dist or the published worker.
        content = Buffer.from(
          content.toString() +
            `\nself.addEventListener('message', event => { if (event.data?.type === 'FICTIONAL_VERSION') event.ports[0]?.postMessage(${version}); });\n`,
        );
      }
      response.writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      done();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Missing local test port");
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    url: origin + "/fitness-pwa/",
    publishNextVersion: () => {
      version++;
    },
    close: () =>
      new Promise<void>((done, reject) => {
        server.close((error) => (error ? reject(error) : done()));
        server.closeAllConnections();
      }),
  };
}
