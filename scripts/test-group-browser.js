// Real Chrome + production React components/store against the local RTDB emulator.
// Optional tooling: esbuild@0.25.12 and Chrome. Run after installing rules/startup via
// run-database-group-check.js <java> <jar> --ui. Never contacts the live Firebase database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const esbuild = require('esbuild');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser, socket, server;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'qe-group-browser-'));
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  try {
    const bundle = await esbuild.build({ entryPoints: ['scripts/fixtures/group-ui.jsx'], bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env': '{}', 'process.env.NODE_ENV': '"development"' } });
    const cssDir = '.next/static/css';
    const css = fs.readdirSync(cssDir).filter((name) => name.endsWith('.css')).map((name) => fs.readFileSync(path.join(cssDir, name))).join('\n');
    const assets = { '/': ['text/html', '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/app.js"></script>'], '/app.js': ['text/javascript', bundle.outputFiles[0].text], '/style.css': ['text/css', css] };
    server = http.createServer((request, response) => { const asset = assets[request.url]; response.writeHead(asset ? 200 : 404, { 'Content-Type': asset?.[0] || 'text/plain' }); response.end(asset?.[1] || 'Not found'); });
    await new Promise((resolve) => server.listen(9100, '127.0.0.1', resolve));
    browser = spawn(chrome, ['--headless=new', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=9334', `--user-data-dir=${temporary}`, 'about:blank'], { stdio: 'ignore' });
    let page;
    for (let i = 0; i < 100; i++) { try { page = (await (await fetch('http://127.0.0.1:9334/json')).json()).find((p) => p.type === 'page'); if (page) break; } catch {} await sleep(100); }
    assert.ok(page, 'Chrome started');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let sequence = 0; const pending = new Map(); const exceptions = [];
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
    socket.onmessage = ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
      if (msg.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true });
      const handler = pending.get(msg.id); if (handler) { pending.delete(msg.id); msg.error ? handler.reject(new Error(msg.error.message)) : handler.resolve(msg.result); }
    };
    const evaluate = async (expression) => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
    const until = async (expression) => { for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await sleep(100); } throw new Error(`UI timeout: ${expression}\n${exceptions.join('\n')}\n${await evaluate('document.body.innerText')}`); };
    const click = (text) => evaluate(`(() => { const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes(${JSON.stringify(text)})); if(!b)throw new Error('Missing button'); b.click(); return true; })()`);
    const field = (selector, value) => evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));return true;})()`);
    const show = async (view, id = 'STD-66122519070', role = 'student') => { await evaluate(`testUI.show(${JSON.stringify(view)},${JSON.stringify(id)},${JSON.stringify(role)});true`); await sleep(200); };
    const attachPdf = () => evaluate(`(() => {const input=document.querySelector('input[type=file][accept=".pdf,application/pdf"]');const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.4\\n%%EOF'],'project.pdf',{type:'application/pdf'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
    await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
    await send('Network.setBlockedURLs', { urls: ['https://*'] });
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: temporary });
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://127.0.0.1:9100/' });
    await until('!!window.testUI && !!document.getElementById("login-identifier")');
    await click('อาจารย์'); await field('#login-identifier', '66122519070@ssru.ac.th');
    await until(`document.querySelector('button[aria-pressed="true"]').textContent.includes('นักศึกษา')`);
    await click('ผู้ดูแลระบบ');
    assert.ok(await evaluate('document.body.innerText.includes("ต้องเลือกประเภทนักศึกษา")'));
    console.log('[PASS] browser automatically selects student email role and intercepts incompatible role selection');

    await evaluate(`testUI.dbStore.saveProfile('student','STD-66122519070',{trackId:'NW'})`);
    await show('profile'); await until('!!document.getElementById("co-advisor-3")');
    assert.equal(await evaluate(`!!document.querySelector('select[aria-label="แทร็กความเชี่ยวชาญ"] option[value="NW"]')`), false);
    assert.equal(await evaluate(`document.querySelector('select[aria-label="แทร็กความเชี่ยวชาญ"]').value`), '');
    assert.ok(!await evaluate(`document.querySelector('label[for="co-advisor-1"]').textContent.includes('(ถ้ามี)')`));
    await field('select[aria-label="แทร็กความเชี่ยวชาญ"]', 'SW');
    await field('#co-advisor-3', 'T-101'); await click('บันทึกข้อมูล'); await until('window.testClosed');
    await show('profile'); await until('!!document.getElementById("co-advisor-3")');
    assert.equal(await evaluate('document.getElementById("co-advisor-3").value'), 'T-101');
    await field('#co-advisor-3', ''); await click('บันทึกข้อมูล'); await until('window.testClosed');
    assert.equal(await evaluate(`testUI.dbStore.getStudentById('STD-66122519070').coAdvisor3Id`), '');
    console.log('[PASS] browser profile removes NW without silently remapping old profiles; third co-advisor saves/reopens/clears');

    await show('documents'); await click('ส่งเอกสาร (.pdf)'); await until('!!document.getElementById("members-proposal")');
    await field('#members-proposal', '66122519071'); await attachPdf(); await click('ส่งให้อาจารย์ที่ปรึกษาตรวจ');
    await until(`testUI.dbStore.getProjectDocuments('STD-66122519071').length===1`);
    await show('documents', 'STD-66122519070', 'teacher'); await until('!!document.querySelector("fieldset textarea")');
    const longText = ('ข้อเสนอแนะหลายบรรทัด\n' + 'longword'.repeat(60) + '\n').repeat(100);
    await field('fieldset textarea', longText);
    await sleep(100);
    assert.ok(await evaluate(`(() => {const e=document.querySelector('fieldset textarea');return e.clientHeight>2000 && e.scrollHeight-e.clientHeight<4 && e.maxLength===-1;})()`));
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await sleep(200);
    assert.ok(await evaluate(`(() => {const e=document.querySelector('fieldset textarea');return e.scrollHeight-e.clientHeight<4;})()`));
    await evaluate(`(async()=>{const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.4\\n%%EOF'],'review.pdf',{type:'application/pdf'}));const canvas=document.createElement('canvas');canvas.width=canvas.height=32;canvas.getContext('2d').fillRect(0,0,32,32);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));transfer.items.add(new File([blob],'review.png',{type:'image/png'}));const input=document.querySelector('fieldset input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await click('ไม่ผ่าน'); await until(`testUI.dbStore.getLatestProjectDocument('STD-66122519071','proposal').status==='rejected'`);
    await show('documents', 'STD-66122519071');
    assert.equal(await evaluate(`testUI.dbStore.getLatestProjectDocument('STD-66122519071','proposal').reviewFeedback`), longText.trim());
    await click('ดูรูปภาพ:'); await until(`!!document.querySelector('img[alt="ข้อเสนอแนะ: review.png"]') && document.querySelector('img[alt="ข้อเสนอแนะ: review.png"]').naturalWidth===32`);
    await click('ดาวน์โหลด PDF:');
    for (let i = 0; i < 100 && !fs.existsSync(path.join(temporary, 'review.pdf')); i++) await sleep(100);
    assert.equal(fs.readFileSync(path.join(temporary, 'review.pdf'), 'utf8'), '%PDF-1.4\n%%EOF');
    console.log('[PASS] real browser textarea expands/reflows on mobile; group recipient loads actual PNG and downloads byte-identical PDF');
    await click('ส่งเอกสารฉบับแก้ไข (.pdf)'); await attachPdf(); await click('ส่งให้อาจารย์ที่ปรึกษาตรวจ');
    await until(`testUI.dbStore.getLatestProjectDocument('STD-66122519070','proposal').version===2`);
    await click('ประวัติการส่ง');
    assert.ok(await evaluate('document.body.innerText.includes("แก้ไขครั้งที่ 1") && document.body.innerText.includes("review.pdf")'));
    assert.equal(await evaluate(`testUI.dbStore.getLatestProjectDocument('STD-66122519070','proposal').studentCode`), '66122519071');
    assert.equal(exceptions.length, 0, exceptions.join('\n'));
    fs.writeFileSync(path.join(temporary, 'group-mobile.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    console.log('[PASS] another group member submits revision 1; original feedback/files remain in expandable history');
    console.log('Browser evidence directory:', temporary);
    console.log('=== GROUP BROWSER CHECKS PASSED (local emulator, production components) ===');
  } finally { socket?.close(); browser?.kill(); server?.close(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
