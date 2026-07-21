/**
 * The action-script assembly (dedup into `_shared_N` vars + `"%DATA%"`
 * substitution) now lives in production at `src/studio/buildActionScript.ts`
 * and is the single source of truth shared by production (`studioAdapter`) and
 * this harness — it is no longer a hand-copy, so it cannot drift. This module
 * just re-exports it so `run.ts` keeps importing from `./buildActionScript`.
 */
export { buildActionScript } from "../../src/studio/buildActionScript";
