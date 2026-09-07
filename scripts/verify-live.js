// Verify the production deployment serves the current build.
// Usage: node scripts/verify-live.js [url]
const https = require("https");

const url = process.argv[2] || "https://qe-sign.vercel.app/";

function getPage(target) {
  return new Promise((resolve, reject) => {
    https
      .get(target, { headers: { "cache-control": "no-cache", "user-agent": "qe-sign-verify" } }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      })
      .on("error", reject);
  });
}

getPage(url)
  .then(async ({ status, headers, body }) => {
    const sources = [...new Set([...body.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]))];
    const assets = await Promise.all(sources.map((source) => getPage(new URL(source, url))));
    const javascript = assets.map((asset) => asset.body).join("\n");
    console.log(`GET ${url} -> ${status}, ${body.length} bytes, x-vercel-id=${headers["x-vercel-id"]}`);
    const checks = [
      ["HTTP 200", status === 200],
      ["all referenced JavaScript assets load", assets.length > 0 && assets.every((asset) => asset.status === 200)],
      ["new document workflow shipped", javascript.includes("pdf://") && javascript.includes("chapter5")],
      ["demo-free cache revision shipped", javascript.includes("SSRU_CE_DATA_STORE_V5")],
      ["new faculty name present", /คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม/.test(body)],
      ["old faculty name absent", !/คณะเทคโนโลยีอุตสาหกรรม/.test(body)],
      ["self-registration absent", !/ลงทะเบียน(สมาชิก|นักศึกษา)ใหม่/.test(body)],
      ["no hardcoded test credentials", !/123456/.test(body)],
      ["session-check placeholder (new landing page)", /กำลังตรวจสอบสถานะการเข้าสู่ระบบ/.test(body)],
      ["Firebase Realtime Sync badge (new header)", /Firebase Realtime Sync/.test(body)],
    ];
    let failures = 0;
    for (const [name, ok] of checks) {
      console.log(`[${ok ? "PASS" : "FAIL"}] ${name}`);
      if (!ok) failures++;
    }
    process.exitCode = failures ? 1 : 0;
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
