// Mirrors the Zoom Meeting SDK's static assets into public/zoom-lib/ so the
// iframe at public/zoom-meeting.html can load them. Runs cross-platform (no
// shell built-ins) so it works on macOS, Linux, and Windows.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sdkRoot = path.join(root, 'node_modules', '@zoom', 'meetingsdk', 'dist');
const outDir = path.join(root, 'public', 'zoom-lib');
// The SDK's internal webpack publicPath resolves some chunks (CSS, preview UMD,
// etc.) to `/ui/` regardless of setZoomJSLib. Mirror to /public/ui/ too so those
// requests resolve in prod.
const uiOutDir = path.join(root, 'public', 'ui');

if (!fs.existsSync(sdkRoot)) {
  console.warn(`[mirror-zoom-assets] Skipping — ${sdkRoot} not found.`);
  process.exit(0);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

fs.cpSync(path.join(sdkRoot, 'lib'), outDir, { recursive: true });
fs.cpSync(path.join(sdkRoot, 'ui'), outDir, { recursive: true });
fs.copyFileSync(
  path.join(sdkRoot, 'zoom-meeting-6.0.0.min.js'),
  path.join(outDir, 'zoom-meeting-6.0.0.min.js'),
);

fs.rmSync(uiOutDir, { recursive: true, force: true });
fs.mkdirSync(uiOutDir, { recursive: true });
fs.cpSync(path.join(sdkRoot, 'ui'), uiOutDir, { recursive: true });

console.log(`[mirror-zoom-assets] Mirrored Zoom SDK assets to ${path.relative(root, outDir)} and ${path.relative(root, uiOutDir)}`);
