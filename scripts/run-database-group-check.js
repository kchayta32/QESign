// Run with node -r ./scripts/register-ts.js scripts/run-database-group-check.js <java.exe> <database-emulator.jar>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { rtdb } = require('../src/lib/firebase/config.ts');
const { ref } = require('firebase/database');
const namespace = new URL(ref(rtdb).toString()).hostname.split('.')[0];
const java = process.argv[2];
const jar = process.argv[3];
assert.ok(java && jar, 'Provide the Java executable and RTDB emulator jar paths');
const emulator = spawn(java, ['-jar', jar, '--host', '127.0.0.1', '--port', '9000'], { stdio: 'ignore' });
let startError;
emulator.on('error', (error) => { startError = error; });
(async () => {
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (startError) throw startError;
      try { const response = await fetch(`http://127.0.0.1:9000/.json?ns=${namespace}`); if (response.ok) { ready = true; break; } } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Emulator started');
    const installed = await fetch(`http://127.0.0.1:9000/.settings/rules.json?ns=${namespace}`, {
      method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: fs.readFileSync('database.rules.json', 'utf8'),
    });
    const result = await installed.text();
    assert.equal(installed.status, 200, `Rules compilation: ${result}`);
    console.log('[PASS] Real database emulator compiled database.rules.json');
    const test = spawn(process.execPath, ['-r', './scripts/register-ts.js', 'scripts/test-database-groups.js'], { stdio: 'inherit' });
    const code = await new Promise((resolve, reject) => { test.on('error', reject); test.on('exit', resolve); });
    assert.equal(code, 0, 'Database integration tests');
    if (process.argv.includes('--ui')) {
      const browser = spawn(process.execPath, ['scripts/test-group-browser.js'], { stdio: 'inherit' });
      const browserCode = await new Promise((resolve, reject) => { browser.on('error', reject); browser.on('exit', resolve); });
      assert.equal(browserCode, 0, 'Browser integration tests');
    }
  } finally { emulator.kill(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
