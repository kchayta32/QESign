// Verification for the PBKDF2 password helper (runs against the real TS source).
// Usage: node -r ./scripts/register-ts.js scripts/test-password.js
const { hashPassword, verifyPassword, validateNewPassword } = require("../src/lib/security/password.ts");

let failures = 0;
function check(name, ok, extra = "") {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${extra ? " -> " + extra : ""}`);
  if (!ok) failures++;
}

(async () => {
  console.log("=== Password helper verification ===");
  const salt = "66122519001";
  const h = await hashPassword("66122519001", salt);
  check("hash has expected format", /^pbkdf2-sha256\$100000\$[0-9a-f]{64}$/.test(h), h.slice(0, 30) + "…");
  check("correct password verifies", await verifyPassword("66122519001", salt, h));
  check("wrong password rejected", !(await verifyPassword("66122519002", salt, h)));
  check("different salt rejected", !(await verifyPassword("66122519001", "66122519002", h)));
  check("missing hash rejected", !(await verifyPassword("x", salt, undefined)));
  check("malformed hash rejected", !(await verifyPassword("x", salt, "garbage")));
  const h2 = await hashPassword("66122519001", salt);
  check("hashing is deterministic for same salt", h === h2);
  const hOther = await hashPassword("parinwat.th", "parinwat.th");
  check("teacher default password verifies", await verifyPassword("parinwat.th", "parinwat.th", hOther));
  check("short password validation", validateNewPassword("abc") !== null);
  check("whitespace password validation", validateNewPassword("abc def") !== null);
  check("valid password accepted", validateNewPassword("Str0ngPass") === null);
  console.log(failures === 0 ? "\n=== ALL PASSED ===" : `\n=== ${failures} FAILURE(S) ===`);
  process.exit(failures === 0 ? 0 : 1);
})();
