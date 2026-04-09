import { build } from "bun";
import fs from "fs";
import path from "path";
import { readdir } from "fs/promises";
import { existsSync } from "fs";
import { resolve } from "path";

// Parse --hookPath from args, default to ./scripts/hooks
const hookPathArg = process.argv.find((arg) => arg.startsWith("--hookPath="));
const hookDir =
  hookPathArg?.split("=")[1] ?? resolve(import.meta.dir, "hooks");

/**
 * Run all hooks found in the hooks directory
 * @param {Object} context - Context object passed to each hook
 * @param {string} context.outDir - Path to the output directory
 * @param {string[]} context.outputs - Paths to all output files
 * @param {Error|null} context.error - Error object if build failed, null otherwise
 */
async function runHooks(context) {
  if (!existsSync(hookDir)) {
    return;
  }

  try {
    const files = await readdir(hookDir);
    const hookFiles = files.filter(
      (f) => f.endsWith(".ts") || f.endsWith(".js")
    );

    for (const file of hookFiles) {
      const hookPath = resolve(hookDir, file);
      console.log(`Running hook: ${hookPath}`);

      try {
        const hook = await import(hookPath);
        if (typeof hook.default === "function") {
          await hook.default(context);
        } else {
          console.warn(`Hook ${file} does not export a default function`);
        }
      } catch (err) {
        console.error(`Error running hook ${file}:`, err.message);
      }
    }
  } catch (err) {
    console.error(`Error reading hooks directory:`, err.message);
  }
}

async function buildForWeb() {
  console.log("Building for web...");

  const outDir = "./dist";

  const context = {
    outDir,
    outputs: [],
    error: null,
  };

  try {
    const result = await build({
      entrypoints: ["./src/index.tsx"],
      outdir: outDir,
      target: "browser",
      format: "esm",
      minify: false,
      sourcemap: "external",
    });

    console.log("Build completed successfully!");

    // Get the output file path
    const outputPath = path.join(outDir, "index.css");

    try {
      let fileContent = fs.readFileSync(outputPath, "utf-8");

      // Check if the CSS rule exists
      const cssRuleToFind =
        /\*,\s*\*:before,\s*\*:after\s*\{\s*box-sizing:\s*border-box;\s*\}/;

      if (cssRuleToFind.test(fileContent)) {
        console.log("Found the CSS rule, replacing it...");

        // Replace the CSS rule
        fileContent = fileContent.replace(
          cssRuleToFind,
          `[class^="m_"] *,
[class^="m_"] *::before,
[class^="m_"] *::after {
  box-sizing: border-box;
}`
        );
      } else {
        console.error("CSS rule not found! Deleting index.css file.");
        fs.unlinkSync(outputPath);
        throw new Error("Required CSS rule not found in the output file.");
      }

      // Write the updated content back to the file
      fs.writeFileSync(outputPath, fileContent, "utf-8");

      console.log("Post-processing completed of index.css");
    } catch (fileError) {
      console.error("Failed to modify the output file:", fileError);
      process.exit(1);
    }

    context.outputs = result.outputs.map((o) => o.path);
    console.log(`Output: ${context.outputs.join(", ")}`);
  } catch (error) {
    context.error = error;
    console.error("Build failed:", error);
  }

  // Run hooks (always, so hooks can handle errors too)
  await runHooks(context);

  if (context.error) {
    process.exit(1);
  }
}

buildForWeb();
