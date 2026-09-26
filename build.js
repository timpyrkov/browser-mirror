// A simple, dependency-free build script for creating browser-specific extension packages.

const fs = require('fs');
const path = require('path');

// --- Configuration ---
const srcDir = path.join(__dirname, 'src');
const manifestsDir = path.join(__dirname, 'manifests');
const targetsDir = path.join(__dirname, 'targets');
const distDir = path.join(__dirname, 'dist');

// --- Helper Functions ---

/**
 * Recursively copies a directory and its contents.
 * @param {string} src The source directory path.
 * @param {string} dest The destination directory path.
 */
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // skip hidden files (e.g. .DS_Store)

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// --- Main Build Logic ---

/**
 * Builds the extension for a specific browser.
 * @param {string} browser The target browser.
 */
function build(browser) {
  const supportedBrowsers = ['firefox', 'chrome', 'opera', 'yandex'];
  if (!supportedBrowsers.includes(browser)) {
    console.error(`Invalid browser specified: ${browser}. Use ${supportedBrowsers.join(', ')}.`);
    process.exit(1);
  }

  console.log(`Building for ${browser}...`);

  const browserDistDir = path.join(distDir, browser);

  // 1. Clean up previous build
  if (fs.existsSync(browserDistDir)) {
    fs.rmSync(browserDistDir, { recursive: true, force: true });
  }
  fs.mkdirSync(browserDistDir, { recursive: true });

  // 2. Copy source files from src/ to dist/[browser]/
  copyDirRecursive(srcDir, browserDistDir);

  const targetDir = path.join(targetsDir, browser);
  if (fs.existsSync(targetDir)) {
    copyDirRecursive(targetDir, browserDistDir);
  }

  // 3. Copy the correct manifest file
  const manifestSrc = path.join(manifestsDir, `${browser}.json`);
  const manifestDest = path.join(browserDistDir, 'manifest.json');
  fs.copyFileSync(manifestSrc, manifestDest);

  console.log(`Successfully built for ${browser} in ${browserDistDir}`);
}

// --- Script Execution ---

const browser = process.argv[2];
if (!browser) {
  console.error('Build target not specified. Usage: node build.js [firefox|chrome|opera|yandex]');
  process.exit(1);
}

build(browser);
