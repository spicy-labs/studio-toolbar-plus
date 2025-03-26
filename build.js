import { build } from "bun";
import fs from "fs";
import path from "path";

async function buildForWeb() {
  console.log("Building for web...");

  try {
    const result = await build({
      entrypoints: ["./src/index.tsx"],
      outdir: "./dist",
      target: "browser",
      format: "esm",
      minify: false,
      sourcemap: "external",
    });

    console.log("Build completed successfully!");

    // Get the output file path
    const outputPath = path.join("./dist", "index.css");

    // Replace %STYLE% in the output file

    try {
      let fileContent = fs.readFileSync(outputPath, "utf-8");

      // Check if the CSS rule exists
      const cssRuleToFind = /\*,\s*\*:before,\s*\*:after\s*\{\s*box-sizing:\s*border-box;\s*\}/;
      
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

    console.log(`Output: ${result.outputs.map((o) => o.path).join(", ")}`);
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

buildForWeb();
