// Production Build and Preview Verification Script for RoadRisk AI
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

console.log('🧪 [TEST] Starting RoadRisk AI Production Preview Verification...');

// 1. Verify build artifacts in dist/
assert(fs.existsSync('dist/index.html'), 'dist/index.html must exist');
const html = fs.readFileSync('dist/index.html', 'utf-8');
assert(html.includes('RoadRisk AI'), 'HTML must contain title');
assert(html.includes('vendor-maplibre'), 'HTML or chunk must reference vendor-maplibre');
assert(fs.existsSync('dist/firebase-messaging-sw.js'), 'dist/firebase-messaging-sw.js must exist for service worker');
console.log('  ✅ Dist artifacts verified: index.html, vendor chunks, and firebase-messaging-sw.js present');

// 2. Launch vite preview on port 4173
const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
  stdio: 'pipe',
  shell: true,
});

let previewStarted = false;
await new Promise((resolve) => {
  const timeout = setTimeout(() => resolve(), 4000);
  preview.stdout.on('data', (d) => {
    const s = d.toString();
    if (s.includes('4173') || s.includes('Local:')) {
      previewStarted = true;
      clearTimeout(timeout);
      resolve();
    }
  });
  preview.stderr.on('data', () => {});
});

try {
  const res = await fetch('http://localhost:4173/');
  assert.strictEqual(res.status, 200, 'Production preview responds with 200');
  const body = await res.text();
  assert(body.includes('RoadRisk AI'), 'Preview HTML serves application root');
  console.log('  ✅ Production preview running on port 4173 and serving index.html cleanly');

  // Verify service worker
  const swRes = await fetch('http://localhost:4173/firebase-messaging-sw.js');
  assert.strictEqual(swRes.status, 200, 'Service worker served on preview port 4173');
  console.log('  ✅ Service worker served with 200 OK from production preview');
} finally {
  try {
    preview.kill();
  } catch {}
}

console.log('🎉 Production Preview Verification Passed Successfully!\n');
