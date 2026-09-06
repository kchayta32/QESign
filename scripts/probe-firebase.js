// Diagnostic: probe Firebase Auth provider + Realtime Database reachability.
// Does NOT print secrets. Usage: node scripts/probe-firebase.js
const fs = require("fs");
const path = require("path");
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getDatabase, ref, get } = require("firebase/database");

const src = fs.readFileSync(path.join(__dirname, "../src/lib/firebase/config.ts"), "utf8");
const pick = (k) => {
  const m = src.match(new RegExp(k + `:\\s*process\\.env\\.[A-Z_]+\\s*\\|\\|\\s*"([^"]+)"`));
  return m ? m[1] : undefined;
};
const cfg = {
  apiKey: pick("apiKey"),
  authDomain: pick("authDomain"),
  databaseURL: pick("databaseURL"),
  projectId: pick("projectId"),
  storageBucket: pick("storageBucket"),
  messagingSenderId: pick("messagingSenderId"),
  appId: pick("appId"),
};
console.log("projectId:", cfg.projectId, "| apiKey present:", !!cfg.apiKey);

(async () => {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  try {
    await signInWithEmailAndPassword(auth, "probe-nonexistent-user@ssru.ac.th", "probe-password-xyz");
    console.log("AUTH: unexpected success");
  } catch (e) {
    console.log("AUTH probe error code:", e.code);
  }
  const db = getDatabase(app, cfg.databaseURL);
  try {
    const snap = await get(ref(db, "ssru_ce"));
    if (!snap.exists()) {
      console.log("RTDB: readable, node ssru_ce is EMPTY");
    } else {
      const v = snap.val();
      const summary = {};
      for (const k of Object.keys(v)) {
        const node = v[k];
        summary[k] = node && typeof node === "object" ? Object.keys(node).slice(0, 8) : typeof node;
      }
      console.log("RTDB: readable, ssru_ce children:", JSON.stringify(summary, null, 1));
    }
  } catch (e) {
    console.log("RTDB read error:", e.code || e.message);
  }
  process.exit(0);
})();
