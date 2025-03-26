import { watch } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

// Configuration
const SRC_DIR = './src';
const FILE_EXTENSIONS = ['.ts', '.tsx'];
const BUILD_COMMAND = 'bun';
const BUILD_ARGS = ['build.js'];

console.log('?? Watching for changes in', SRC_DIR);
console.log('?? Will run', `${BUILD_COMMAND} ${BUILD_ARGS.join(' ')}`, 'on changes\n');

// Initial build
runBuild();

// Set up file watcher
function watchDir(dir) {
  watch(dir, { recursive: true }, (_, filename) => {
    if (!filename) return;

    const ext = '.' + filename.split('.').pop();
    if (FILE_EXTENSIONS.includes(ext)) {
      console.log(`?? Change detected in: ${filename}`);
      runBuild();
    }
  });
}

// Run the build command
function runBuild() {
  const now = new Date();
  console.log(`???  Running build at ${now.toLocaleString()}...`);

  const startTime = Date.now();
  const buildProcess = spawn(BUILD_COMMAND, BUILD_ARGS, { stdio: 'inherit' });

  buildProcess.on('close', (code) => {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    if (code === 0) {
      console.log(`? Build completed successfully in ${duration.toFixed(2)}s`);
    } else {
      console.error(`? Build failed with code ${code}`);
    }
    console.log(''); // Empty line for better readability
  });

  buildProcess.on('error', (err) => {
    console.error('? Failed to start build process:', err);
  });
}

// Start watching
watchDir(SRC_DIR);