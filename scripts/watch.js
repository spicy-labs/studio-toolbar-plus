import { watch } from "fs";
import { spawn } from "child_process";

// Configuration
const SRC_DIR = "./src";
const FILE_EXTENSIONS = [".ts", ".tsx"];
const PRETTIER_COMMAND = "bunx";
const BUILD_COMMAND = "bun";
const BUILD_ARGS = ["build.js"];

// Track files being processed to avoid infinite loops
const processingFiles = new Set();

console.log("?? Watching for changes in", SRC_DIR);
console.log(
  "?? Will run prettier on changed files and",
  `${BUILD_COMMAND} ${BUILD_ARGS.join(" ")}`,
  "on changes\n"
);

// Initial build
runInitialBuild();

// Set up file watcher
function watchDir(dir) {
  watch(dir, { recursive: true }, (_, filename) => {
    if (!filename) return;

    const ext = "." + filename.split(".").pop();
    if (FILE_EXTENSIONS.includes(ext)) {
      // Skip if this file is currently being processed by prettier
      if (processingFiles.has(filename)) {
        return;
      }

      console.log(`?? Change detected in: ${filename}`);
      runPrettierAndBuild(filename);
    }
  });
}

// Run prettier on specific file and then build
function runPrettierAndBuild(filename) {
  const now = new Date();
  console.log(`???  Running prettier and build at ${now.toLocaleString()}...`);

  const startTime = Date.now();
  const filePath = `${SRC_DIR}/${filename}`;

  // Mark file as being processed
  processingFiles.add(filename);

  // First run prettier on the specific file
  console.log(`?? Running prettier on ${filename}...`);
  const prettierProcess = spawn(
    PRETTIER_COMMAND,
    ["prettier", "--write", filePath],
    {
      stdio: "inherit",
    }
  );

  prettierProcess.on("close", (code) => {
    // Remove file from processing set after a short delay to allow file system to settle
    setTimeout(() => {
      processingFiles.delete(filename);
    }, 100);

    if (code === 0) {
      console.log("? Prettier completed successfully");
      // Now run the build
      console.log("?? Running build...");
      const buildProcess = spawn(BUILD_COMMAND, BUILD_ARGS, {
        stdio: "inherit",
      });

      buildProcess.on("close", (buildCode) => {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        if (buildCode === 0) {
          console.log(
            `? Build completed successfully in ${duration.toFixed(2)}s`
          );
        } else {
          console.error(`? Build failed with code ${buildCode}`);
        }
        console.log(""); // Empty line for better readability
      });

      buildProcess.on("error", (err) => {
        console.error("? Failed to start build process:", err);
      });
    } else {
      console.error(`? Prettier failed with code ${code}`);
      console.log(""); // Empty line for better readability
    }
  });

  prettierProcess.on("error", (err) => {
    // Remove file from processing set on error
    processingFiles.delete(filename);
    console.error("? Failed to start prettier process:", err);
  });
}

// Initial build without prettier (since no specific file changed)
function runInitialBuild() {
  const now = new Date();
  console.log(`???  Running initial build at ${now.toLocaleString()}...`);

  const startTime = Date.now();
  const buildProcess = spawn(BUILD_COMMAND, BUILD_ARGS, {
    stdio: "inherit",
  });

  buildProcess.on("close", (code) => {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    if (code === 0) {
      console.log(
        `? Initial build completed successfully in ${duration.toFixed(2)}s`
      );
    } else {
      console.error(`? Initial build failed with code ${code}`);
    }
    console.log(""); // Empty line for better readability
  });

  buildProcess.on("error", (err) => {
    console.error("? Failed to start initial build process:", err);
  });
}

// Start watching
watchDir(SRC_DIR);
