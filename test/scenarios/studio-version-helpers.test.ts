import { describe, test, expect } from "bun:test";
import {
  compareSdkPublic,
  classifySave,
  getEnvFromTemplateUpdateUrl,
  getEnvFromTemplateCreateUrl,
  getEnvFromComponentUpdateUrl,
  getEnvFromComponentCreateUrl,
} from "../../src/utils/studioVersion";

const BASE = "https://cp-uef-142.chili-publish.online/grafx/api/v1/environment";
const ENV = "cp-uef-142";
const ID = "8f2a1c40-0000-4000-8000-000000000001";

describe("compareSdkPublic", () => {
  test("compares numerically, not lexically", () => {
    // The whole point: "1.9" sorts AFTER "1.46" as a string but is older.
    expect(compareSdkPublic("1.9", "1.46")).toBe(-1);
    expect(compareSdkPublic("1.46", "1.9")).toBe(1);
  });

  test("equal versions", () => {
    expect(compareSdkPublic("1.46", "1.46")).toBe(0);
  });

  test("major segment wins over minor", () => {
    expect(compareSdkPublic("2.1", "1.99")).toBe(1);
    expect(compareSdkPublic("1.99", "2.1")).toBe(-1);
  });

  test("ignores a patch segment", () => {
    expect(compareSdkPublic("1.46.0", "1.46")).toBe(0);
    expect(compareSdkPublic("1.46.3", "1.46.9")).toBe(0);
    expect(compareSdkPublic("1.46.0", "1.45.9")).toBe(1);
  });

  test("a bare major is treated as x.0", () => {
    expect(compareSdkPublic("2", "2.0")).toBe(0);
    expect(compareSdkPublic("2", "2.1")).toBe(-1);
  });

  test("unparseable input yields null", () => {
    expect(compareSdkPublic("latest", "1.46")).toBeNull();
    expect(compareSdkPublic("1.46", "latest")).toBeNull();
    expect(compareSdkPublic("", "1.46")).toBeNull();
    expect(compareSdkPublic("1.46", "")).toBeNull();
    expect(compareSdkPublic("1.", "1.46")).toBeNull();
    expect(compareSdkPublic("x.y", "1.46")).toBeNull();
    expect(compareSdkPublic("main", "next")).toBeNull();
  });
});

describe("template update URL matching", () => {
  test("matches the plain update URL", () => {
    expect(getEnvFromTemplateUpdateUrl(`${BASE}/${ENV}/templates/${ID}`)).toBe(
      ENV,
    );
  });

  test("matches with a trailing slash, query string or fragment", () => {
    expect(getEnvFromTemplateUpdateUrl(`${BASE}/${ENV}/templates/${ID}/`)).toBe(
      ENV,
    );
    expect(
      getEnvFromTemplateUpdateUrl(`${BASE}/${ENV}/templates/${ID}?name=Foo`),
    ).toBe(ENV);
    expect(
      getEnvFromTemplateUpdateUrl(`${BASE}/${ENV}/templates/${ID}/?name=Foo`),
    ).toBe(ENV);
    expect(
      getEnvFromTemplateUpdateUrl(`${BASE}/${ENV}/templates/${ID}#frag`),
    ).toBe(ENV);
  });

  test("does not match sub-paths of a template", () => {
    for (const suffix of [
      "/preview",
      "/preview/png",
      "/download",
      "/preview?foo=1",
    ]) {
      expect(
        getEnvFromTemplateUpdateUrl(`${BASE}/${ENV}/templates/${ID}${suffix}`),
      ).toBeNull();
    }
  });

  test("does not match the import endpoint", () => {
    expect(
      getEnvFromTemplateUpdateUrl(`${BASE}/${ENV}/templates/import`),
    ).toBeNull();
  });

  test("does not match template-collections", () => {
    expect(
      getEnvFromTemplateUpdateUrl(`${BASE}/${ENV}/template-collections`),
    ).toBeNull();
    expect(
      getEnvFromTemplateUpdateUrl(
        `${BASE}/${ENV}/template-collections/c-1/templates/${ID}`,
      ),
    ).toBeNull();
  });

  test("does not match the bare templates collection URL", () => {
    expect(getEnvFromTemplateUpdateUrl(`${BASE}/${ENV}/templates`)).toBeNull();
    expect(getEnvFromTemplateUpdateUrl(`${BASE}/${ENV}/templates/`)).toBeNull();
    expect(
      getEnvFromTemplateUpdateUrl(`${BASE}/${ENV}/templates?name=Foo`),
    ).toBeNull();
  });
});

describe("template create URL matching", () => {
  test("matches the collection URL", () => {
    expect(getEnvFromTemplateCreateUrl(`${BASE}/${ENV}/templates`)).toBe(ENV);
  });

  test("matches with a trailing slash, query string or fragment", () => {
    expect(getEnvFromTemplateCreateUrl(`${BASE}/${ENV}/templates/`)).toBe(ENV);
    expect(
      getEnvFromTemplateCreateUrl(`${BASE}/${ENV}/templates?name=Foo`),
    ).toBe(ENV);
    expect(
      getEnvFromTemplateCreateUrl(`${BASE}/${ENV}/templates/?name=Foo`),
    ).toBe(ENV);
    expect(getEnvFromTemplateCreateUrl(`${BASE}/${ENV}/templates#frag`)).toBe(
      ENV,
    );
  });

  test("does not match an individual template URL", () => {
    expect(
      getEnvFromTemplateCreateUrl(`${BASE}/${ENV}/templates/${ID}`),
    ).toBeNull();
    expect(
      getEnvFromTemplateCreateUrl(`${BASE}/${ENV}/templates/${ID}/preview`),
    ).toBeNull();
  });

  test("does not match import, download or template-collections", () => {
    expect(
      getEnvFromTemplateCreateUrl(`${BASE}/${ENV}/templates/import`),
    ).toBeNull();
    expect(
      getEnvFromTemplateCreateUrl(`${BASE}/${ENV}/templates/${ID}/download`),
    ).toBeNull();
    expect(
      getEnvFromTemplateCreateUrl(`${BASE}/${ENV}/template-collections`),
    ).toBeNull();
    expect(
      getEnvFromTemplateCreateUrl(
        `${BASE}/${ENV}/template-collections/c-1/templates/${ID}`,
      ),
    ).toBeNull();
  });
});

describe("component update URL matching", () => {
  test("matches the plain update URL", () => {
    expect(
      getEnvFromComponentUpdateUrl(`${BASE}/${ENV}/components/${ID}`),
    ).toBe(ENV);
  });

  test("matches with a trailing slash, query string or fragment", () => {
    expect(
      getEnvFromComponentUpdateUrl(`${BASE}/${ENV}/components/${ID}/`),
    ).toBe(ENV);
    expect(
      getEnvFromComponentUpdateUrl(`${BASE}/${ENV}/components/${ID}?name=Foo`),
    ).toBe(ENV);
    expect(
      getEnvFromComponentUpdateUrl(`${BASE}/${ENV}/components/${ID}#frag`),
    ).toBe(ENV);
  });

  test("does not match sub-paths, import or the collection URL", () => {
    expect(
      getEnvFromComponentUpdateUrl(`${BASE}/${ENV}/components/${ID}/preview`),
    ).toBeNull();
    expect(
      getEnvFromComponentUpdateUrl(
        `${BASE}/${ENV}/components/${ID}/preview/png`,
      ),
    ).toBeNull();
    expect(
      getEnvFromComponentUpdateUrl(`${BASE}/${ENV}/components/${ID}/download`),
    ).toBeNull();
    expect(
      getEnvFromComponentUpdateUrl(`${BASE}/${ENV}/components/import`),
    ).toBeNull();
    expect(
      getEnvFromComponentUpdateUrl(`${BASE}/${ENV}/components`),
    ).toBeNull();
  });
});

describe("component create URL matching", () => {
  test("matches the collection URL", () => {
    expect(getEnvFromComponentCreateUrl(`${BASE}/${ENV}/components`)).toBe(ENV);
  });

  test("matches with a trailing slash, query string or fragment", () => {
    expect(getEnvFromComponentCreateUrl(`${BASE}/${ENV}/components/`)).toBe(
      ENV,
    );
    expect(
      getEnvFromComponentCreateUrl(`${BASE}/${ENV}/components?name=Foo`),
    ).toBe(ENV);
    expect(getEnvFromComponentCreateUrl(`${BASE}/${ENV}/components#frag`)).toBe(
      ENV,
    );
  });

  test("does not match an individual component URL or import", () => {
    expect(
      getEnvFromComponentCreateUrl(`${BASE}/${ENV}/components/${ID}`),
    ).toBeNull();
    expect(
      getEnvFromComponentCreateUrl(`${BASE}/${ENV}/components/${ID}/preview`),
    ).toBeNull();
    expect(
      getEnvFromComponentCreateUrl(`${BASE}/${ENV}/components/import`),
    ).toBeNull();
  });
});

describe("classifySave", () => {
  test("an absent or empty body is a rename, for both kinds", () => {
    for (const kind of ["template", "component"] as const) {
      expect(classifySave(kind, null)).toBe("rename");
      expect(classifySave(kind, undefined)).toBe("rename");
      expect(classifySave(kind, "")).toBe("rename");
      expect(classifySave(kind, "   \n ")).toBe("rename");
    }
  });

  test("a non-empty body we cannot parse is unknown (fail closed)", () => {
    for (const kind of ["template", "component"] as const) {
      expect(classifySave(kind, "[object Blob]")).toBe("unknown");
      expect(classifySave(kind, " binary")).toBe("unknown");
      expect(classifySave(kind, "{not json")).toBe("unknown");
    }
  });

  test("a body that parses to a non-object is unknown", () => {
    for (const kind of ["template", "component"] as const) {
      expect(classifySave(kind, "[]")).toBe("unknown");
      expect(classifySave(kind, '[{"content":{}}]')).toBe("unknown");
      expect(classifySave(kind, "null")).toBe("unknown");
      expect(classifySave(kind, '"just a string"')).toBe("unknown");
      expect(classifySave(kind, "42")).toBe("unknown");
    }
  });

  test("template: either version key marks a save", () => {
    expect(
      classifySave("template", JSON.stringify({ documentVersion: "1.5.0" })),
    ).toBe("save");
    // Legacy documents carry only one of the two — hence the `||`.
    expect(
      classifySave("template", JSON.stringify({ engineVersion: "2.29.0" })),
    ).toBe("save");
    expect(
      classifySave(
        "template",
        JSON.stringify({
          documentVersion: "1.5.0",
          engineVersion: "2.29.0",
          pages: [],
        }),
      ),
    ).toBe("save");
  });

  test("template: any other object body is unknown, not rename", () => {
    expect(classifySave("template", JSON.stringify({ name: "Renamed" }))).toBe(
      "unknown",
    );
    expect(classifySave("template", "{}")).toBe("unknown");
  });

  test("component: a rename body omits content", () => {
    expect(
      classifySave(
        "component",
        JSON.stringify({
          name: "Renamed",
          defaultComponentDimensions: { width: 100, height: 50 },
        }),
      ),
    ).toBe("rename");
    expect(classifySave("component", "{}")).toBe("rename");
  });

  test("component: content present is a save, object or string", () => {
    expect(
      classifySave(
        "component",
        JSON.stringify({
          content: { documentVersion: "1.5.0" },
          defaultComponentDimensions: { width: 100, height: 50 },
        }),
      ),
    ).toBe("save");
    // The dev path where `content` arrives as a JSON string must still count.
    expect(
      classifySave(
        "component",
        JSON.stringify({ content: '{"documentVersion":"1.5.0"}' }),
      ),
    ).toBe("save");
    // Even a null content: the key is present, so we do not risk it.
    expect(classifySave("component", JSON.stringify({ content: null }))).toBe(
      "save",
    );
  });
});
