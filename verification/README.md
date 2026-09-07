# Production verification — 2026-09-07

Application source commit: `75ba9ff1cf72a656f8ca2b705823d4fa3063f52d`.
The later evidence-only commit does not change the deployed application.

- Production: https://qe-sign.vercel.app
- Deployment: `dpl_5YppNkH2wpv9jPciAHhcNQqdqBxq` (Vercel Ready, production)
- Immutable deployment URL: https://qe-sign-lm79k224w-sgtkchayta-7331s-projects.vercel.app
- [Vercel build](https://vercel.com/sgtkchayta-7331s-projects/qe-sign/5YppNkH2wpv9jPciAHhcNQqdqBxq)
- [GitLab MR](https://gitlab.com/kitti-group1/qe-ce-ssru/-/merge_requests/1)

## Inspectable evidence

- [`production/browser-evidence.json`](production/browser-evidence.json): emitted by the real Chrome CDP test only after assertions, with source commit/deployment ID, SHA-256 of all 13 referenced production JS assets, screenshot hash, fixture paths and read-back cleanup result.
- [`production/production-pdf-submitted.png`](production/production-pdf-submitted.png): production browser after selecting a generated valid one-page PDF and completing the acknowledged upload with an isolated synthetic student.
- [`production/firebase-smoke.log`](production/firebase-smoke.log): captured stdout/stderr from a second successful live integration run, including two independent REST clients racing a booking slot, concurrent evaluation/replay, negative validation cases, and cleanup of all 20 fixture paths. Permission-denied warnings are expected assertions, not a failed run.

Commands actually executed successfully:

```text
npm test
npm run typecheck
npm run build
npm run smoke:ssr
vercel deploy --prod --yes
node scripts/deploy-database-rules.js --confirm-live
node -r ./scripts/register-ts.js scripts/smoke-firebase-documents.js --confirm-live
npm run verify:live -- https://qe-sign.vercel.app
node -r ./scripts/register-ts.js scripts/smoke-browser.js https://qe-sign.vercel.app --confirm-live --artifacts=verification/production --deployment=dpl_5YppNkH2wpv9jPciAHhcNQqdqBxq
```

Vercel's build command also ran the entire test suite (including `test-realtime.js`), typecheck and build successfully. The new realtime test drives actual store subscriptions with controlled SDK callbacks: optimistic approval, rollback, real 15-second timeout/late acknowledgement, concurrent booking calls and stable evaluation identity. It does not disable or replace the store behavior under test.

## Scope and limitations

- Browser checks cover hydration, 390px landing layout, student/teacher first-profile saves with resized photos, PDF selection/upload/reload/withdraw, runtime errors and cleanup. Synthetic sessions are restored; this is **not** an actual production-account password-login test. Credential validation is exercised by offline account/auth tests.
- Three-stage document review, chapter3 revocation, QE booking/cancellation/rebooking/result and concurrent-client behavior are tested against the live database APIs/store, not all through browser forms.
- Only synthetic records were mutated. Deployment preflight found 0 bookings and 0 results, so no legacy booking-slot migration was needed. Root/unrelated rules were preserved; the current rules-only backup is `%TEMP%/qe-rules-VDrAxP/before.rules.json`.
- Existing public root RTDB access remains a serious authorization limitation. These consistency validators do not secure personal data or enforce user roles. Coordinated Firebase Auth/ownership rules work is still required.
- Java was unavailable, so Firebase emulator coverage is unverified; actual deployed rules were syntax-checked, read-back verified and exercised with isolated live fixtures instead. Provision Java via `.gitlab/duo/agent-config.yml` for future emulator testing.
- The initial new typecheck failed on ES5 iteration of Set/Map; replacing direct iterator spreads with `Array.from` fixed it. Subsequent local typecheck/build/SSR and full Vercel checks passed. Local Webpack cache path-case warnings did not fail compilation.
