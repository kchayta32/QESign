// Update only /ssru_ce rules in the shared CE ROOM database. Preserve unrelated rules.
// Uses the Firebase CLI's existing login; never reads credential/environment files.
// Dry run by default. Usage: node scripts/deploy-database-rules.js --confirm-live
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');
const project = 'ce-room-da794';
const getRules = () => JSON.parse(execSync(`firebase database:get /.settings/rules --project ${project}`, { encoding: 'utf8', timeout: 60000 }));
const current = getRules();
const desired = JSON.parse(fs.readFileSync(path.join(__dirname, '../database.rules.json'), 'utf8'));
assert.ok(desired.rules.ssru_ce);
const merged = { rules: { ...current.rules, ssru_ce: desired.rules.ssru_ce } };
const unrelated = (rules) => Object.fromEntries(Object.entries(rules).filter(([key]) => key !== 'ssru_ce'));
assert.deepEqual(unrelated(merged.rules), unrelated(current.rules));
console.log('Only /ssru_ce validation/index rules will change; root access and all unrelated rules are preserved.');
if (!process.argv.includes('--confirm-live')) {
  console.log('Dry run only. Add --confirm-live to deploy.');
} else {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qe-rules-'));
  fs.writeFileSync(path.join(dir, 'before.rules.json'), JSON.stringify(current, null, 2));
  fs.writeFileSync(path.join(dir, 'database.rules.json'), JSON.stringify(merged, null, 2));
  fs.writeFileSync(path.join(dir, 'firebase.json'), JSON.stringify({ database: { rules: 'database.rules.json' } }));
  console.log(`Rules-only backup: ${path.join(dir, 'before.rules.json')}`);
  execSync(`firebase deploy --only database --project ${project} --config "${path.join(dir, 'firebase.json')}" --non-interactive`, { stdio: 'inherit', timeout: 120000 });
  const deployed = getRules();
  assert.deepEqual(deployed, merged, 'read-back rules match the scoped deployment');
  console.log('[PASS] deployed /ssru_ce rules and verified read-back; unrelated rules unchanged');
}
