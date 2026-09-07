// Chrome CDP smoke: real hydrated UI, responsive landing, first-profile save for both
// roles with an actual canvas-generated image. Restores synthetic sessions (credential
// validation is covered separately). Creates/removes only DUO-BROWSER-* cloud fixtures.
// Usage: node -r ./scripts/register-ts.js scripts/smoke-browser.js https://qe-sign.vercel.app --confirm-live
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ref, get, update, query, orderByChild, equalTo } = require('firebase/database');
const { rtdb } = require('../src/lib/firebase/config.ts');
const { dbStore } = require('../src/lib/firebase/db.ts');
const { persistChanges, RTDB_ROOT } = require('../src/lib/firebase/rtdb.ts');
if (!process.argv.includes('--confirm-live')) throw new Error('Requires --confirm-live');
const target = process.argv[2];
const artifactDir = process.argv.find((arg) => arg.startsWith('--artifacts='))?.slice('--artifacts='.length);
const evidence = { target, deploymentId: process.argv.find((arg) => arg.startsWith('--deployment='))?.slice('--deployment='.length),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), startedAt: new Date().toISOString(),
  checks: [], screenshots: [], assets: [], cleanupVerified: false, passed: false };
const log = console.log;
console.log = (...args) => { evidence.checks.push(args.join(' ')); log(...args); };
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qe-browser-'));
const prefix = `DUO-BROWSER-${Date.now()}`;
const studentId = `${prefix}-STUDENT`, teacherId = `${prefix}-TEACHER`;
const cleanup = { [`students/${studentId}`]: null, [`teachers/${teacherId}`]: null,
  [`avatars/students/${studentId}`]: null, [`avatars/teachers/${teacherId}`]: null };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser, socket, send;
(async () => {
  try {
    if (artifactDir) {
      assert.ok(evidence.deploymentId, '--deployment is required with --artifacts');
      fs.mkdirSync(artifactDir, { recursive: true });
      const response = await fetch(target);
      assert.equal(response.status, 200);
      evidence.vercelRequestId = response.headers.get('x-vercel-id');
      const html = await response.text();
      for (const source of new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]))) {
        const url = new URL(source, target).href;
        const asset = await fetch(url);
        assert.equal(asset.status, 200);
        evidence.assets.push({ url, sha256: createHash('sha256').update(Buffer.from(await asset.arrayBuffer())).digest('hex') });
      }
    }
    browser = spawn(chrome, ['--headless=new', '--no-first-run', '--disable-background-networking',
      '--remote-debugging-port=9333', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
    let page;
    for (let i = 0; i < 100; i++) {
      try { page = (await (await fetch('http://127.0.0.1:9333/json')).json()).find((p) => p.type === 'page'); if (page) break; } catch {}
      await sleep(100);
    }
    assert.ok(page, 'Chrome debugging endpoint');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let sequence = 0;
    const pending = new Map();
    const exceptions = [];
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
      pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      socket.send(JSON.stringify({ id, method, params }));
    });
    socket.onmessage = ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.text);
      if (msg.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true });
      const handler = pending.get(msg.id);
      if (handler) { pending.delete(msg.id); msg.error ? handler.reject(new Error(msg.error.message)) : handler.resolve(msg.result); }
    };
    await send('Runtime.enable');
    await send('Page.enable');
    const capture = async (name) => {
      if (!artifactDir) return;
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      const bytes = Buffer.from(screenshot.data, 'base64');
      fs.writeFileSync(path.join(artifactDir, `${name}.png`), bytes);
      evidence.screenshots.push({ file: `${name}.png`, sha256: createHash('sha256').update(bytes).digest('hex') });
    };
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const until = async (expression) => {
      for (let i = 0; i < 120; i++) { if (await evaluate(expression)) return; await sleep(100); }
      throw new Error(`UI timeout: ${expression}`);
    };
    await send('Page.navigate', { url: target });
    await until("document.body.innerText.includes('ส่งเอกสารโครงงาน (PDF)')");
    console.log('[PASS] hydrated production landing includes PDF workflow');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'mobile horizontal overflow');
    console.log('[PASS] 390px landing has no horizontal overflow');
    await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });

    const student = { ...dbStore.getStudentById('STD-66122519020'), id: studentId, uid: studentId,
      studentCode: prefix, email: 'browser-check@example.invalid', firstNameTh: 'ทดสอบ', lastNameTh: 'ชั่วคราว',
      phone: '0000000000', advisorId: teacherId, profileCompleted: false, avatarUrl: '', passwordHash: undefined };
    const teacher = { ...dbStore.getTeacherById('T-108'), id: teacherId, uid: teacherId, teacherCode: teacherId,
      email: 'browser-teacher@example.invalid', firstNameTh: 'ทดสอบ', lastNameTh: 'ชั่วคราว', phone: '0000000000',
      profileCompleted: false, avatarUrl: '', passwordHash: undefined };
    await persistChanges({ [`students/${studentId}`]: student, [`teachers/${teacherId}`]: teacher });
    for (const [role, id] of [['student', studentId], ['teacher', teacherId]]) {
      await evaluate(`localStorage.setItem('SSRU_CE_AUTH_SESSION_V2', JSON.stringify(${JSON.stringify({ role, entityId: id })})); location.reload(); true`);
      await until("!!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('บันทึกและเริ่มใช้งานระบบ'))");
      await evaluate(`(async () => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#a6192e'; ctx.fillRect(0,0,256,256);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'profile.png', { type: 'image/png' }));
        const input = document.querySelector('input[type=file][accept="image/*"]');
        input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await until("!!document.querySelector('img[src^=\"data:image/jpeg\"]')");
      const start = performance.now();
      await evaluate("Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('บันทึกและเริ่มใช้งานระบบ')).click(); true");
      await until("!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('บันทึกและเริ่มใช้งานระบบ') || b.textContent.includes('กำลังบันทึก'))");
      const ms = Math.round(performance.now() - start);
      const saved = (await get(ref(rtdb, `${RTDB_ROOT}/${role === 'student' ? 'students' : 'teachers'}/${id}`))).val();
      assert.equal(saved.profileCompleted, true);
      assert.ok(saved.avatarUrl?.startsWith('avatar://') || saved.avatarUrl?.startsWith('data:image/jpeg'));
      assert.ok(ms < 10000, 'profile save must not wait for Storage SDK retries');
      console.log(`[PASS] browser ${role} profile + resized image saved and cloud-confirmed in ${ms} ms`);
    }
    await evaluate(`localStorage.setItem('SSRU_CE_AUTH_SESSION_V2', JSON.stringify(${JSON.stringify({ role: 'student', entityId: studentId })})); location.reload(); true`);
    await until(`!!document.querySelector('button[title="เปิดเมนูเอกสารโครงงาน"]')`);
    await evaluate(`document.querySelector('button[title="เปิดเมนูเอกสารโครงงาน"]').click(); true`);
    await until("document.body.innerText.includes('เอกสารโครงงาน: Proposal')");
    await evaluate("Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'ส่งเอกสาร (.pdf)').click(); true");
    await until(`!!document.querySelector('input[type=file][accept=".pdf,application/pdf"]')`);
    const pdfText = require('./pdf-fixture')();
    await evaluate(`(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([${JSON.stringify(pdfText)}], 'browser-proposal.pdf', { type: 'application/pdf' }));
      const input = document.querySelector('input[type=file][accept=".pdf,application/pdf"]');
      input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await until("document.body.innerText.includes('browser-proposal.pdf')");
    await evaluate("Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('ส่งให้อาจารย์ที่ปรึกษาตรวจ')).click(); true");
    await until("document.body.innerText.includes('เปิดไฟล์ PDF') && !document.body.innerText.includes('กำลังอัปโหลด') && !document.querySelector('input[accept=\".pdf,application/pdf\"]')");
    const submissions = (await get(query(ref(rtdb, `${RTDB_ROOT}/projectDocuments`), orderByChild('studentId'), equalTo(studentId)))).val();
    assert.equal(Object.keys(submissions || {}).length, 1);
    const doc = Object.values(submissions)[0];
    cleanup[`projectDocuments/${doc.id}`] = null;
    cleanup[`documentFiles/${doc.id}`] = null;
    assert.equal(doc.status, 'submitted');
    await capture('production-pdf-submitted');
    assert.equal((await get(ref(rtdb, `${RTDB_ROOT}/documentFiles/${doc.id}`))).val(), `data:application/pdf;base64,${Buffer.from(pdfText).toString('base64')}`);
    await evaluate('location.reload(); true');
    await until(`!!document.querySelector('button[title="เปิดเมนูเอกสารโครงงาน"]')`);
    await evaluate(`document.querySelector('button[title="เปิดเมนูเอกสารโครงงาน"]').click(); true`);
    await until("document.body.innerText.includes('browser-proposal.pdf')");
    await evaluate(`document.querySelector('button[title="ยกเลิกการส่ง (ยังไม่ถูกตรวจ)"]').click(); true`);
    await until("!document.body.innerText.includes('browser-proposal.pdf')");
    assert.equal((await get(ref(rtdb, `${RTDB_ROOT}/projectDocuments/${doc.id}`))).exists(), false);
    assert.equal((await get(ref(rtdb, `${RTDB_ROOT}/documentFiles/${doc.id}`))).exists(), false);
    console.log('[PASS] production browser PDF selection, atomic upload, reload persistence and atomic withdrawal');
    assert.deepEqual(exceptions, [], 'uncaught browser exceptions');
    console.log('[PASS] no uncaught browser runtime exceptions');
    evidence.passed = true;
  } finally {
    if (send) { try { await send('Browser.close'); } catch {} }
    socket?.close(); browser?.kill();
    // Discover this fixture's submissions even when the UI assertion failed before read-back.
    const remaining = (await get(query(ref(rtdb, `${RTDB_ROOT}/projectDocuments`), orderByChild('studentId'), equalTo(studentId)))).val();
    for (const doc of Object.values(remaining || {})) {
      cleanup[`projectDocuments/${doc.id}`] = null;
      cleanup[`documentFiles/${doc.id}`] = null;
    }
    await update(ref(rtdb, RTDB_ROOT), cleanup);
    for (const p of Object.keys(cleanup)) assert.equal((await get(ref(rtdb, `${RTDB_ROOT}/${p}`))).exists(), false);
    console.log(`[PASS] browser fixtures removed and read-back verified (${prefix})`);
    evidence.cleanupVerified = true;
    evidence.fixturePrefix = prefix;
    evidence.cleanupPaths = Object.keys(cleanup);
    evidence.finishedAt = new Date().toISOString();
    if (artifactDir) fs.writeFileSync(path.join(artifactDir, 'browser-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
    await sleep(500);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
  process.exit(0);
})().catch((error) => { console.error(error.message); process.exit(1); });
