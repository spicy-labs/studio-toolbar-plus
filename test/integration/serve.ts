import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "../..");
const port = Number(process.env.PORT ?? 4200);

const routes: Record<string, string> = {
  "/": "test/integration/editor.html",
  "/sdk/main.js": "node_modules/@chili-publish/studio-sdk/_bundles/main.js",
  "/sdk/main.js.map":
    "node_modules/@chili-publish/studio-sdk/_bundles/main.js.map",
  "/fixtures/base-template.json":
    "test/integration/fixtures/base-template.json",
};

const server = Bun.serve({
  port,
  fetch(request) {
    if (request.method !== "GET") {
      return new Response("Not Found", { status: 404 });
    }

    const pathname = new URL(request.url).pathname;
    const relativePath = routes[pathname];

    if (!relativePath) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(Bun.file(resolve(projectRoot, relativePath)));
  },
});

console.log(`Studio integration server listening at http://localhost:${server.port}/`);
