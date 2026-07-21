/**
 * Single source of truth for action-script assembly.
 *
 * This is the deterministic, browser-free core of the script-assembly step in
 * `saveLayoutMappingToAction` (src/studio/studioAdapter.ts): dedup layouts into
 * `_shared_N` vars and substitute the assembled `"%DATA%"` payload into the
 * matcher source. It is imported by BOTH production (`studioAdapter`, which
 * appends the trailing `console.log(...)` invocation) and the test harness, so
 * the two can never drift.
 *
 * Kept PURE — no `window.SDK`, `updateAction`, or any browser-only module — so
 * `bun test` can import it cleanly.
 */
export function buildActionScript(
  actionMap: Record<string, Record<string, any>>,
  matcherSrc: string,
): string {
  const sharedDeclarations: string[] = [];
  const deduped = Object.create(null) as Record<string, string>;
  const seen = new Map<string, string>();

  for (const [layoutName, variableMap] of Object.entries(actionMap)) {
    const json = JSON.stringify(variableMap);
    const existing = seen.get(json);
    if (existing) {
      deduped[layoutName] = existing;
    } else {
      const varName = `_shared_${seen.size}`;
      seen.set(json, varName);
      sharedDeclarations.push(`var ${varName} = ${json};`);
      deduped[layoutName] = varName;
    }
  }

  const dataExpr =
    "{" +
    Object.entries(deduped)
      .map(([layoutName, varName]) => `${JSON.stringify(layoutName)}:${varName}`)
      .join(",") +
    "}";

  return (
    sharedDeclarations.join("\n") +
    "\n" +
    matcherSrc.replace('"%DATA%"', () => dataExpr)
  );
}
