const fs = require("fs");
const path = require("path");
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get } = require("firebase/database");

const src = fs.readFileSync(path.join(__dirname, "../src/lib/firebase/config.ts"), "utf8");
const pick = (k) => {
  const m = src.match(new RegExp(k + `:\\s*process\\.env\\.[A-Z_]+\\s*\\|\\|\\s*"([^"]+)"`));
  return m ? m[1] : undefined;
};
const cfg = {
  apiKey: pick("apiKey"),
  databaseURL: pick("databaseURL"),
  projectId: pick("projectId"),
};
const app = initializeApp(cfg);
const db = getDatabase(app, cfg.databaseURL);

(async () => {
  const tSnap = await get(ref(db, "ssru_ce/teachers"));
  const teachers = tSnap.val() || {};
  console.log("Teachers in cloud count:", Object.keys(teachers).length);
  for (const [id, t] of Object.entries(teachers)) {
    if (t.profileCompleted || t.passwordChanged || t.lastLoginAt || t.passwordHash) {
      console.log(`Teacher ${id}: profileCompleted=${t.profileCompleted}, passwordChanged=${t.passwordChanged}, lastLoginAt=${t.lastLoginAt}, hash=${!!t.passwordHash}`);
    }
  }

  const sSnap = await get(ref(db, "ssru_ce/students"));
  const students = sSnap.val() || {};
  console.log("Students in cloud count:", Object.keys(students).length);
  for (const [id, s] of Object.entries(students)) {
    if (s.profileCompleted || s.passwordChanged || s.passed3Chapter || s.passedQE || s.lastLoginAt || s.passwordHash) {
      console.log(`Student ${id}: profileCompleted=${s.profileCompleted}, passwordChanged=${s.passwordChanged}, passed3Chapter=${s.passed3Chapter}, passedQE=${s.passedQE}, hash=${!!s.passwordHash}`);
    }
  }

  process.exit(0);
})();
