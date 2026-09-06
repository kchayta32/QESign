// SSR smoke test: start the production server (requires `npm run build` first),
// fetch the landing page, assert key markers, stop the server.
// Usage: node scripts/smoke-ssr.js
const { spawn } = require("child_process");
const path = require("path");

const PORT = 3111;
const server = spawn(
  process.execPath,
  ["-r", "./scripts/patch-fs.js", "./node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
  { cwd: path.join(__dirname, ".."), stdio: ["ignore", "pipe", "pipe"] }
);
let stderr = "";
server.stderr.on("data", (d) => (stderr += d.toString()));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let html = null;
  for (let i = 0; i < 40 && html === null; i++) {
    await sleep(1000);
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) html = await res.text();
      else console.log("status", res.status);
    } catch {
      /* not up yet */
    }
  }
  if (html === null) {
    console.log("[FAIL] server did not respond");
    console.log(stderr);
    server.kill("SIGKILL");
    process.exit(1);
  }
  console.log(`STATUS 200, ${html.length} bytes`);
  // Note: the landing page shows a session-check placeholder during SSR and renders the
  // login form after hydration, so only header/footer/placeholder markers are asserted here.
  const checks = [
    ["header sign-in button rendered", /เข้าสู่ระบบ/.test(html)],
    ["session-check placeholder rendered", /กำลังตรวจสอบสถานะการเข้าสู่ระบบ/.test(html)],
    ["faculty name correct", /คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม/.test(html)],
    ["old faculty name gone", !/คณะเทคโนโลยีอุตสาหกรรม/.test(html)],
    ["self-registration removed", !/ลงทะเบียน(สมาชิก|นักศึกษา)ใหม่/.test(html)],
    ["no raw LaTeX in markup", !/\$\\ge/.test(html)],
    ["no hardcoded test credentials", !/123456/.test(html)],
    ["no server-side errors", !/Error:|Unhandled/.test(stderr)],
  ];
  let failures = 0;
  for (const [name, ok] of checks) {
    console.log(`[${ok ? "PASS" : "FAIL"}] ${name}`);
    if (!ok) failures++;
  }
  if (stderr.trim()) console.log("--- server stderr ---\n" + stderr);
  server.kill("SIGKILL");
  await sleep(300);
  process.exit(failures ? 1 : 0);
})();
