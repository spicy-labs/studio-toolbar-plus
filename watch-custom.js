import { watch } from "fs";
import { cp, copyFile } from "fs/promises";
import { join, basename } from "path";
import { spawn } from "child_process";

// Configuration
const SRC_DIR = "./src";
const FILE_EXTENSIONS = [".ts", ".tsx"];
const PRETTIER_COMMAND = "bunx";
const BUILD_COMMAND = "bun";
const BUILD_ARGS = ["build.js"];
const COPY_FILES = ["./manifest.json", "./content.js"];
const COPY_DIRS = ["./dist", "./icons"];
const COPY_LOCATION = "/mnt/c/Users/sean/Code/studio-tool-bar-extension/";

// Track files being processed to avoid infinite loops
const processingFiles = new Set();

console.log("?? Watching for changes in", SRC_DIR);
console.log(
  "?? Will run prettier on changed files and",
  `${BUILD_COMMAND} ${BUILD_ARGS.join(" ")}`,
  "on changes\n"
);

// --- Helper function to copy build artifacts ---
async function copyBuildArtifacts(files, dirs, destination) {
  console.log(`?? Copying artifacts to ${destination}...`);
  try {
    // Copy individual files
    for (const file of files) {
      const fileName = basename(file);
      const destPath = join(destination, fileName);
      await copyFile(file, destPath);
      console.log(`   Copied file: ${fileName}`);
    }

    // Copy directories recursively
    for (const dir of dirs) {
      const dirName = basename(dir);
      const destPath = join(destination, dirName);
      await cp(dir, destPath, { recursive: true });
      console.log(`   Copied directory: ${dirName}`);
    }
    console.log("?? Artifacts copied successfully.");
  } catch (err) {
    console.error("? Error copying artifacts:", err);
  }
}
// --- End Helper ---

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

function watchFiles(files) {
  for (const file of files) {
    watch(file, (_, filename) => {
      if (!filename) return;
      console.log(`?? Change detected in: ${filename}`);
      runInitialBuild(); // These files don't need prettier, just build
    });
  }
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
        env: { NODE_ENV: "production" },
        stdio: "inherit",
      });

      buildProcess.on("close", async (buildCode) => {
        // Make the callback async
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        if (buildCode === 0) {
          console.log(
            `? Build completed successfully in ${duration.toFixed(2)}s`
          );
          // Copy files and directories after successful build
          await copyBuildArtifacts(COPY_FILES, COPY_DIRS, COPY_LOCATION);
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
    env: { NODE_ENV: "production" },
    stdio: "inherit",
  });

  buildProcess.on("close", async (code) => {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    if (code === 0) {
      console.log(
        `? Initial build completed successfully in ${duration.toFixed(2)}s`
      );
      // Copy files and directories after successful build
      await copyBuildArtifacts(COPY_FILES, COPY_DIRS, COPY_LOCATION);
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
watchFiles(COPY_FILES);
