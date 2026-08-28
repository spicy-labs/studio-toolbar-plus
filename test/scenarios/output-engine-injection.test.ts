import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  getEnvFromOutputUrl,
  withEngineVersion,
} from "../../src/utils/studioVersion";

const BASE = "https://cp-uef-142.chili-publish.online/grafx/api/v1/environment";

describe("output URL matching", () => {
  test("matches every generate-output format", () => {
    for (const format of ["jpg", "png", "mp4", "gif", "pdf", "html"]) {
      expect(getEnvFromOutputUrl(`${BASE}/cp-uef-142/output/${format}`)).toBe(
        "cp-uef-142",
      );
    }
  });

  test("matches with a query string or fragment", () => {
    expect(getEnvFromOutputUrl(`${BASE}/cp-uef-142/output/pdf?foo=1`)).toBe(
      "cp-uef-142",
    );
  });

  test("does not match the output-settings endpoints", () => {
    expect(getEnvFromOutputUrl(`${BASE}/cp-uef-142/output/settings/png`)).toBe(
      null,
    );
    expect(getEnvFromOutputUrl(`${BASE}/cp-uef-142/output/settings`)).toBe(null);
  });

  test("does not match task polling or download", () => {
    expect(
      getEnvFromOutputUrl(`${BASE}/cp-uef-142/output/tasks/abc-123`),
    ).toBe(null);
    expect(
      getEnvFromOutputUrl(`${BASE}/cp-uef-142/output/tasks/abc-123/download`),
    ).toBe(null);
  });

  test("does not match unrelated endpoints", () => {
    expect(getEnvFromOutputUrl(`${BASE}/cp-uef-142/settings`)).toBe(null);
    expect(getEnvFromOutputUrl(`${BASE}/cp-uef-142/projects/abc`)).toBe(null);
  });

  test("tolerates a trailing slash — same endpoint", () => {
    expect(getEnvFromOutputUrl(`${BASE}/cp-uef-142/output/pdf/`)).toBe(
      "cp-uef-142",
    );
  });
});

/**
 * The bootstrap is a hand-maintained copy of this logic (it has no imports by
 * design — see ticket 021). Until the duplication is removed at build time,
 * pin the one piece that silently changes what gets rewritten.
 */
describe("bootstrap mirror does not drift", () => {
  const extractRegex = (src: string) =>
    src.match(/\/\\\/grafx[^\n]*?\/(?=[,;])/)?.[0] ?? null;

  test("both implementations use the same output-URL regex", () => {
    const fromUtil = extractRegex(
      readFileSync("src/utils/studioVersion.ts", "utf8"),
    );
    const fromBootstrap = extractRegex(
      readFileSync("interceptor-bootstrap.js", "utf8"),
    );

    expect(fromUtil).not.toBe(null);
    expect(fromBootstrap).not.toBe(null);
    expect(fromBootstrap).toBe(fromUtil);
  });
});

describe("engine version injection", () => {
  test("adds engineVersion when absent", () => {
    const body = JSON.stringify({ projectId: "p1", layoutsToExport: ["0"] });
    const out = JSON.parse(withEngineVersion(body, "2.15")!);
    expect(out.engineVersion).toBe("2.15");
    expect(out.projectId).toBe("p1");
  });

  test("overwrites an engineVersion the app already set", () => {
    const body = JSON.stringify({ projectId: "p1", engineVersion: "2.29.2" });
    expect(JSON.parse(withEngineVersion(body, "2.15")!).engineVersion).toBe(
      "2.15",
    );
  });

  test("overwrites a null engineVersion — what studio-ui sends in prod", () => {
    const body = JSON.stringify({ projectId: "p1", engineVersion: null });
    expect(JSON.parse(withEngineVersion(body, "2.15")!).engineVersion).toBe(
      "2.15",
    );
  });

  test("preserves the rest of the body verbatim", () => {
    const original = {
      outputSettingsId: "os-1",
      layoutsToExport: ["0"],
      documentContent: { engineVersion: "2.29.2", nested: { a: [1, 2] } },
      dataConnectorConfig: null,
    };
    const out = JSON.parse(
      withEngineVersion(JSON.stringify(original), "2.15")!,
    );
    // documentContent.engineVersion is the document's own stamp — untouched.
    expect(out.documentContent).toEqual(original.documentContent);
    expect(out.outputSettingsId).toBe("os-1");
    expect(out.dataConnectorConfig).toBe(null);
  });

  test("returns null for non-JSON-object bodies", () => {
    expect(withEngineVersion("not json", "2.15")).toBe(null);
    expect(withEngineVersion("[1,2,3]", "2.15")).toBe(null);
    expect(withEngineVersion("null", "2.15")).toBe(null);
    expect(withEngineVersion('"a string"', "2.15")).toBe(null);
  });
});
