/**
 * Anonymizing scenario extractor  (KEPT DEV TOOL — never imported by tests/CI)
 *
 *   bun scripts/anonymize-template.ts <client-doc.json> <out-fixture.json>
 *
 * Reads a client CHILI document LOCALLY and emits a synthetic `{ doc, layoutMaps }`
 * fixture that preserves the image-selection LOGIC (group topology, membership
 * sets, dedup collisions, precedence overlaps) while discarding all client
 * content. The client file never enters the repo — only the anonymized output.
 *
 * Design: EXTRACT-AND-SYNTHESIZE (allowlist), not redact. We read only the few
 * fields the pipeline consumes and rebuild a fresh minimal doc, so nothing else
 * (connector urls, page content, brand kit, checksums, metadata…) can leak.
 *
 * Anonymization is a CONSISTENT BIJECTION: every occurrence of a source string
 * maps to the same synthetic token, and distinct sources never collide (each
 * gets a fresh counter). That's what keeps the logic intact — equal values stay
 * equal (membership/dedup preserved), unequal stay unequal.
 */

import { layoutMappingToActionMap } from "../src/studio/layoutMappingToActionMap";
import { imageSelectionScript } from "../src/studio/actions/imageSelection.js";
import { buildActionScript } from "../test/harness/buildActionScript";

// ---- token maps (bijective, per category) ----------------------------------

function tokenizer(prefix: string) {
  const map = new Map<string, string>();
  return (source: string): string => {
    let t = map.get(source);
    if (t === undefined) {
      t = `${prefix}_${map.size + 1}`;
      map.set(source, t);
    }
    return t;
  };
}

const mapVarId = tokenizer("varid");
const mapVarName = tokenizer("Var");
const mapLayoutId = tokenizer("layoutid");
const mapLayoutName = tokenizer("Layout");
const mapValue = tokenizer("val"); // list items + dependent values (shared space)
const mapLiteral = tokenizer("lit"); // output literals inside variableValue
const mapTransformStr = tokenizer("tok"); // transform find/replace strings

// ---- allowlisted extraction ------------------------------------------------

const SUPPORTED = new Set([
  "image",
  "shortText",
  "longText",
  "list",
  "boolean",
  "number",
]);

interface RawVar {
  id: string;
  name: string;
  type: string;
  items?: { value: string; displayValue?: string }[];
  selected?: string;
  value?: unknown;
}

function findToolbar(clientDoc: any): any {
  for (const layout of clientDoc.layouts ?? []) {
    const tb = layout?.privateData?.toolbar;
    if (typeof tb === "string") return JSON.parse(tb);
  }
  throw new Error("No privateData.toolbar found on any layout");
}

/** Build the original (un-anonymized) Doc the producer needs, for the parity check. */
function extractOriginalDoc(clientDoc: any) {
  const variables = (clientDoc.variables ?? [])
    .filter((v: RawVar) => SUPPORTED.has(v.type))
    .map((v: RawVar) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      value: v.type === "list" ? (v.selected ?? "") : "",
      items: v.type === "list" ? (v.items ?? []).map((i) => ({ value: i.value })) : undefined,
    }));
  const layouts = (clientDoc.layouts ?? []).map((l: any) => ({
    id: l.id,
    name: l.name,
    parentId: l.parentId ?? undefined,
  }));
  return { layouts, variables };
}

// ---- anonymizers -----------------------------------------------------------

function anonVariable(v: any) {
  const out: any = {
    id: mapVarId(v.id),
    name: mapVarName(v.name),
    type: v.type,
    value: v.type === "boolean" ? false : "",
  };
  if (v.type === "list") {
    out.items = (v.items ?? []).map((i: any) => ({ value: mapValue(i.value) }));
  }
  return out;
}

function anonLayout(l: any) {
  const out: any = { id: mapLayoutId(l.id), name: mapLayoutName(l.name) };
  if (l.parentId) out.parentId = mapLayoutId(l.parentId);
  return out;
}

function anonVariableValue(parts: any[]): any[] {
  return parts.map((p) => {
    if (typeof p === "string") return mapLiteral(p);
    if (p?.type === "TextareaValue") return { type: "TextareaValue", value: mapLiteral(p.value) };
    // A `${var}` reference: { id, type, transform }
    return {
      id: p.id == null ? p.id : mapVarId(p.id),
      type: p.type,
      transform: (p.transform ?? []).map((t: any) => ({
        find: mapTransformStr(t.find),
        replace: mapTransformStr(t.replace),
        replaceAll: t.replaceAll,
        regex: t.regex,
      })),
    };
  });
}

function anonGroup(g: any) {
  const out: any = {};
  if (g.alwaysRun) out.alwaysRun = true;
  out.dependents = (g.dependents ?? []).map((d: any) => ({
    variableId: mapVarId(d.variableId),
    values: (d.values ?? []).map(mapValue),
  }));
  out.variableValue = anonVariableValue(g.variableValue ?? []);
  return out;
}

function anonLayoutMaps(layoutMaps: any[]) {
  return layoutMaps.map((lm) => ({
    id: mapVarId(lm.id ?? "map"),
    name: lm.name ? mapLayoutName(lm.name) : undefined,
    layoutIds: (lm.layoutIds ?? []).map(mapLayoutId),
    variables: (lm.variables ?? []).map((tv: any) => ({
      id: mapVarId(tv.id),
      type: tv.type,
      dependentGroup: (tv.dependentGroup ?? []).map(anonGroup),
    })),
  }));
}

// ---- verification ----------------------------------------------------------

/** No original content string may survive anywhere in the output. */
function assertNoLeaks(clientDoc: any, originalDoc: any, originalMaps: any, output: any) {
  const forbidden = new Set<string>();
  for (const v of originalDoc.variables) {
    forbidden.add(v.name);
    for (const i of v.items ?? []) forbidden.add(i.value);
  }
  for (const l of originalDoc.layouts) if (l.name) forbidden.add(l.name);
  const collect = (parts: any[]) => {
    for (const p of parts) {
      if (typeof p === "string") forbidden.add(p);
      else if (p?.type === "TextareaValue") forbidden.add(p.value);
    }
  };
  for (const lm of originalMaps) {
    for (const tv of lm.variables ?? []) {
      for (const g of tv.dependentGroup ?? []) {
        for (const d of g.dependents ?? []) for (const val of d.values ?? []) forbidden.add(val);
        collect(g.variableValue ?? []);
      }
    }
  }
  forbidden.delete("");
  const serialized = JSON.stringify(output);
  const leaked = [...forbidden].filter(
    (s) => s && s.length > 1 && serialized.includes(JSON.stringify(s).slice(1, -1)),
  );
  if (leaked.length) {
    throw new Error(`LEAK CHECK FAILED — original content survived: ${leaked.slice(0, 10).join(", ")}`);
  }
}

/** The anonymized inputs must reproduce the same logic structure. */
function assertLogicPreserved(originalMaps: any, originalDoc: any, output: any) {
  const matcher = imageSelectionScript.toString();
  const sharedCount = (maps: any, doc: any) =>
    (buildActionScript(layoutMappingToActionMap(maps, doc), matcher).match(/var _shared_\d+ =/g) ?? [])
      .length;
  const groupStats = (maps: any, doc: any) => {
    const am = layoutMappingToActionMap(maps, doc);
    let keys = 0, entries = 0, depSlots = 0, always = 0, layouts = 0;
    for (const vmap of Object.values(am) as any[]) {
      layouts++;
      for (const groups of Object.values(vmap) as any[]) {
        for (const key of Object.keys(groups)) {
          if (key === "_always_run") { always++; continue; }
          keys++;
          for (const e of groups[key]) { entries++; depSlots += e.deps.length; }
        }
      }
    }
    return { sharedCount: sharedCount(maps, doc), keys, entries, depSlots, always, layouts };
  };
  const a = groupStats(originalMaps, originalDoc);
  const b = groupStats(output.layoutMaps, output.doc);
  const eq = JSON.stringify(a) === JSON.stringify(b);
  if (!eq) {
    throw new Error(
      `LOGIC CHECK FAILED — structure changed under anonymization:\n  original: ${JSON.stringify(a)}\n  anon:     ${JSON.stringify(b)}`,
    );
  }
  return b;
}

// ---- main ------------------------------------------------------------------

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    console.error("usage: bun scripts/anonymize-template.ts <client-doc.json> <out-fixture.json>");
    process.exit(1);
  }

  const clientDoc = JSON.parse(await Bun.file(inputPath).text());
  const toolbar = findToolbar(clientDoc);
  const originalMaps = toolbar.layoutMaps ?? [];
  const originalDoc = extractOriginalDoc(clientDoc);

  const output = {
    _note:
      "Synthetic fixture — anonymized from a client template. Structure/logic preserved; all content is meaningless tokens. Generated by scripts/anonymize-template.ts.",
    doc: {
      layouts: originalDoc.layouts.map(anonLayout),
      variables: originalDoc.variables.map(anonVariable),
    },
    layoutMaps: anonLayoutMaps(originalMaps),
  };

  assertNoLeaks(clientDoc, originalDoc, originalMaps, output);
  const stats = assertLogicPreserved(originalMaps, originalDoc, output);

  await Bun.write(outputPath, JSON.stringify(output, null, 2));
  console.log(`✓ wrote ${outputPath}`);
  console.log(`  leak check: passed   logic check: passed`);
  console.log(`  stats: ${JSON.stringify(stats)}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
