import { describe, test, expect } from "bun:test";
import { layoutMappingValidation } from "../../src/studio-adapter/layoutMapingValidation";
import type { LayoutMap } from "../../src/types/layoutConfigTypes";
import type { Doc } from "../../src/types/docStateTypes";

function makeDoc(overrides?: Partial<Doc>): Doc {
  return {
    layouts: [
      { id: "layout-1", name: "Banner" },
      { id: "layout-2", name: "Poster" },
    ],
    variables: [
      { id: "img-1", name: "Hero", isVisiblie: true, type: "image", value: "" },
      { id: "list-1", name: "Size", isVisiblie: true, type: "list", value: "M", items: [{ value: "S" }, { value: "M" }, { value: "L" }] },
      { id: "text-1", name: "Caption", isVisiblie: true, type: "shortText", value: "hello" },
    ],
    ...overrides,
  };
}

function makeMap(overrides?: Partial<LayoutMap>): LayoutMap {
  return {
    id: "map-1",
    name: "Test Mapping",
    layoutIds: ["layout-1"],
    variables: [
      {
        id: "img-1",
        type: "StudioImage",
        dependentGroup: [
          {
            dependents: [{ variableId: "list-1", values: ["M"] }],
            variableValue: ["hero_M.png"],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("layoutMappingValidation", () => {
  test("clean config passes through unchanged", () => {
    const doc = makeDoc();
    const map = makeMap();
    const { cleanLayoutMap, report } = layoutMappingValidation(map, doc);

    expect(cleanLayoutMap.layoutIds).toEqual(["layout-1"]);
    expect(cleanLayoutMap.variables).toHaveLength(1);
    expect(cleanLayoutMap.variables[0].dependentGroup).toHaveLength(1);
    expect(report.removedLayoutIds).toEqual([]);
    expect(report.removedVariables).toEqual([]);
    expect(report.removedDependents).toEqual([]);
    expect(report.removedVariableValues).toEqual([]);
  });

  test("removes stale layout IDs and reports them", () => {
    const doc = makeDoc();
    const map = makeMap({ layoutIds: ["layout-1", "GONE-LAYOUT"] });
    const { cleanLayoutMap, report } = layoutMappingValidation(map, doc);

    expect(cleanLayoutMap.layoutIds).toEqual(["layout-1"]);
    expect(report.removedLayoutIds).toEqual(["GONE-LAYOUT"]);
  });

  test("removes stale target variable and reports it", () => {
    const doc = makeDoc();
    const map = makeMap({
      variables: [
        {
          id: "GONE-VAR",
          type: "StudioImage",
          dependentGroup: [
            { dependents: [], variableValue: ["x.png"] },
          ],
        },
      ],
    });
    const { cleanLayoutMap, report } = layoutMappingValidation(map, doc);

    expect(cleanLayoutMap.variables).toHaveLength(0);
    expect(report.removedVariables).toEqual(["GONE-VAR"]);
  });

  test("removes stale dependent variable from group and reports it", () => {
    const doc = makeDoc();
    const map = makeMap({
      variables: [
        {
          id: "img-1",
          type: "StudioImage",
          dependentGroup: [
            {
              dependents: [
                { variableId: "list-1", values: ["M"] },
                { variableId: "GONE-DEP", values: ["x"] },
              ],
              variableValue: ["hero.png"],
            },
          ],
        },
      ],
    });
    const { cleanLayoutMap, report } = layoutMappingValidation(map, doc);

    const group = cleanLayoutMap.variables[0].dependentGroup[0];
    expect(group.dependents).toHaveLength(1);
    expect(group.dependents[0].variableId).toBe("list-1");
    expect(report.removedDependents).toEqual([
      { variableId: "GONE-DEP", imageVariableId: "img-1" },
    ]);
  });

  test("removes stale VariableValue references and reports them", () => {
    const doc = makeDoc();
    const map = makeMap({
      variables: [
        {
          id: "img-1",
          type: "StudioImage",
          dependentGroup: [
            {
              dependents: [{ variableId: "list-1", values: ["M"] }],
              variableValue: [
                "prefix_",
                { id: "GONE-REF", type: "StudioText", transform: [] },
                { id: "text-1", type: "StudioText", transform: [] },
              ],
            },
          ],
        },
      ],
    });
    const { cleanLayoutMap, report } = layoutMappingValidation(map, doc);

    const values = cleanLayoutMap.variables[0].dependentGroup[0].variableValue;
    expect(values).toHaveLength(2);
    expect(values[0]).toBe("prefix_");
    expect((values[1] as any).id).toBe("text-1");
    expect(report.removedVariableValues).toEqual([
      { value: "GONE-REF", imageVariableId: "img-1", dependentGroupIndex: 0 },
    ]);
  });

  test("preserves string values during cleanup", () => {
    const doc = makeDoc();
    const map = makeMap({
      variables: [
        {
          id: "img-1",
          type: "StudioImage",
          dependentGroup: [
            {
              dependents: [{ variableId: "list-1", values: ["M"] }],
              variableValue: ["literal_string", "another_literal"],
            },
          ],
        },
      ],
    });
    const { cleanLayoutMap } = layoutMappingValidation(map, doc);

    const values = cleanLayoutMap.variables[0].dependentGroup[0].variableValue;
    expect(values).toEqual(["literal_string", "another_literal"]);
  });

  test("preserves VariableValue with null id (never-selected slot)", () => {
    const doc = makeDoc();
    const map = makeMap({
      variables: [
        {
          id: "img-1",
          type: "StudioImage",
          dependentGroup: [
            {
              dependents: [{ variableId: "list-1", values: ["M"] }],
              variableValue: [
                { id: null, type: "StudioText", transform: [] } as any,
              ],
            },
          ],
        },
      ],
    });
    const { cleanLayoutMap, report } = layoutMappingValidation(map, doc);

    const values = cleanLayoutMap.variables[0].dependentGroup[0].variableValue;
    expect(values).toHaveLength(1);
    expect((values[0] as any).id).toBeNull();
    expect(report.removedVariableValues).toEqual([]);
  });

  test("drops group when all dependents AND all values are removed", () => {
    const doc = makeDoc();
    const map = makeMap({
      variables: [
        {
          id: "img-1",
          type: "StudioImage",
          dependentGroup: [
            {
              dependents: [{ variableId: "GONE-DEP", values: ["x"] }],
              variableValue: [
                { id: "GONE-REF", type: "StudioText", transform: [] },
              ],
            },
          ],
        },
      ],
    });
    const { cleanLayoutMap } = layoutMappingValidation(map, doc);

    expect(cleanLayoutMap.variables[0].dependentGroup).toHaveLength(0);
  });

  test("keeps group when dependents are removed but values remain", () => {
    const doc = makeDoc();
    const map = makeMap({
      variables: [
        {
          id: "img-1",
          type: "StudioImage",
          dependentGroup: [
            {
              dependents: [{ variableId: "GONE-DEP", values: ["x"] }],
              variableValue: ["literal.png"],
            },
          ],
        },
      ],
    });
    const { cleanLayoutMap } = layoutMappingValidation(map, doc);

    expect(cleanLayoutMap.variables[0].dependentGroup).toHaveLength(1);
    expect(cleanLayoutMap.variables[0].dependentGroup[0].dependents).toHaveLength(0);
    expect(cleanLayoutMap.variables[0].dependentGroup[0].variableValue).toEqual(["literal.png"]);
  });

  test("keeps group when values are removed but dependents remain", () => {
    const doc = makeDoc();
    const map = makeMap({
      variables: [
        {
          id: "img-1",
          type: "StudioImage",
          dependentGroup: [
            {
              dependents: [{ variableId: "list-1", values: ["M"] }],
              variableValue: [
                { id: "GONE-REF", type: "StudioText", transform: [] },
              ],
            },
          ],
        },
      ],
    });
    const { cleanLayoutMap } = layoutMappingValidation(map, doc);

    expect(cleanLayoutMap.variables[0].dependentGroup).toHaveLength(1);
    expect(cleanLayoutMap.variables[0].dependentGroup[0].dependents).toHaveLength(1);
    expect(cleanLayoutMap.variables[0].dependentGroup[0].variableValue).toHaveLength(0);
  });

  test("does not mutate the original input (deep-copy guarantee)", () => {
    const doc = makeDoc();
    const map = makeMap({
      layoutIds: ["layout-1", "GONE-LAYOUT"],
      variables: [
        {
          id: "img-1",
          type: "StudioImage",
          dependentGroup: [
            {
              dependents: [
                { variableId: "list-1", values: ["M"] },
                { variableId: "GONE-DEP", values: ["x"] },
              ],
              variableValue: ["hero.png"],
            },
          ],
        },
      ],
    });

    const originalJson = JSON.stringify(map);
    layoutMappingValidation(map, doc);
    expect(JSON.stringify(map)).toBe(originalJson);
  });

  test("target variable with null id is preserved along with its groups", () => {
    const doc = makeDoc();
    const map = makeMap({
      variables: [
        {
          id: null as any,
          type: "StudioImage",
          dependentGroup: [
            {
              dependents: [{ variableId: "list-1", values: ["M"] }],
              variableValue: ["fallback.png"],
            },
          ],
        },
      ],
    });
    const { cleanLayoutMap, report } = layoutMappingValidation(map, doc);

    expect(cleanLayoutMap.variables).toHaveLength(1);
    expect(cleanLayoutMap.variables[0].id).toBeNull();
    expect(cleanLayoutMap.variables[0].dependentGroup).toHaveLength(1);
    expect(report.removedVariables).toEqual([]);
  });
});
