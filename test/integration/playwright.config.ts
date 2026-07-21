import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
    testDir: "./scenarios",
    timeout: 60_000,
    retries: 1,
    workers: 1,
    use: {
        baseURL: "http://localhost:4200",
    },
    projects: [
        // Gate: engine-contract checks that must pass before we trust any
        // image-target behavior. If this fails, the integration project is
        // skipped entirely.
        { name: "gate", testMatch: /\.gate\.ts$/ },
        {
            name: "integration",
            testMatch: /\.integration\.ts$/,
            dependencies: ["gate"],
        },
        // Opt-in: runs the real fixture corpus through the engine (differential
        // vs the Bun mock). Slow — invoked only by `test:integration:full`.
        {
            name: "fixtures",
            testMatch: /\.fixtures\.ts$/,
            dependencies: ["gate"],
        },
    ],
    webServer: {
        command: "bun test/integration/serve.ts",
        cwd: resolve(import.meta.dirname, "../.."),
        url: "http://localhost:4200",
        reuseExistingServer: !process.env.CI,
        timeout: 10_000,
    },
});
