# Production verification — 2026-09-07

Application source commit: `aa32d7ca43210bb1dbccc14b17d9328a88787274` (includes the authoritative booking/revocation fix in `530494d`).
The later evidence-only commit does not change the deployed application.

- Production: https://qe-sign.vercel.app
- Deployment: `dpl_DbpTkFps1A94Z1orEmnb6SKkGKwV` (Vercel Ready, production; alias confirmed with `vercel inspect`)
- Immutable deployment URL: https://qe-sign-mkjm8hbad-sgtkchayta-7331s-projects.vercel.app
- [Vercel build](https://vercel.com/sgtkchayta-7331s-projects/qe-sign/DbpTkFps1A94Z1orEmnb6SKkGKwV)
- [GitLab branch](https://gitlab.com/kitti-group1/qe-ce-ssru/-/tree/duo/fix/first-login-project-documents): regular push succeeded and `git ls-remote` confirmed the application source commit. The existing MR API lookup returned HTTP 404; no MR update is claimed.

## Inspectable evidence

- [`production/browser-evidence.json`](production/browser-evidence.json): emitted by the real Chrome CDP test only after assertions, with source commit/deployment ID, SHA-256 of all 13 referenced production JS assets, screenshot hash, fixture paths and read-back cleanup result.
- [`production/production-co-advisors.png`](production/production-co-advisors.png) and [`production/production-co-advisors-mobile.png`](production/production-co-advisors-mobile.png): both optional dropdowns after saving and reloading from the live database, desktop and 390px viewport.
- [`production/production-pdf-submitted.png`](production/production-pdf-submitted.png): production browser after selecting a generated valid one-page PDF and completing the acknowledged upload with an isolated synthetic student.
- [`production/firebase-smoke.log`](production/firebase-smoke.log): captured stdout/stderr from this run's successful live integration check, including two independent REST clients racing a booking slot, **booking versus chapter3 revocation**, stale-review rejection and authoritative-slot retry, concurrent evaluation/replay, negative validation cases, and cleanup of all **21** fixture paths. Permission-denied warnings are expected assertions, not a failed run. Only trailing SDK whitespace was trimmed from this log for `git diff --check`.

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
node -r ./scripts/register-ts.js scripts/smoke-browser.js https://qe-sign.vercel.app --confirm-live --artifacts=verification/production --deployment=dpl_DbpTkFps1A94Z1orEmnb6SKkGKwV
vercel inspect qe-sign-mkjm8hbad-sgtkchayta-7331s-projects.vercel.app
```

Vercel's build command also ran the entire test suite (including `test-realtime.js`), typecheck and build successfully. The realtime test drives actual store subscriptions with controlled SDK callbacks: optimistic approval, rollback, real 15-second timeout/late acknowledgement, concurrent booking calls, stable evaluation identity, and both booking-first/revocation-first acknowledgement orders. It does not disable or replace the store behavior under test.

The added profile persistence regression exercises acknowledgement/rejection and explicit clearing of both co-advisor fields without changing the primary advisor. The Chrome test verifies first-login save with both fields blank, identical teacher/Other options and associated labels, one/both selections, reload read-back, second-co-advisor advisee visibility, custom-name validation/trimming/restoration, and clearing either field. It also passed against the local production build before deployment.

## Scope and limitations

- Browser checks cover hydration, 390px landing/profile layout, student/teacher first-profile saves with resized photos, the optional co-advisor cases above, PDF selection/upload/reload/withdraw, runtime errors and cleanup. Synthetic sessions are restored; this is **not** an actual production-account password-login test. Credential validation is exercised by offline account/auth tests.
- Three-stage document review, chapter3 revocation, QE booking/cancellation/rebooking/result and concurrent-client behavior are tested against the live database APIs/store, not all through browser forms.
- Only synthetic account/transaction records were mutated. Browser cleanup verified all 6 paths; Firebase smoke cleanup verified all 21 paths. Root/unrelated rules were preserved; the current rules-only backup is `%TEMP%/qe-rules-qosZph/before.rules.json`. Scoped deployment syntax checking and exact read-back verification passed.
- Existing public root RTDB access remains a serious authorization limitation. These consistency validators do not secure personal data or enforce user roles. Coordinated Firebase Auth/ownership rules work is still required.
- Firebase emulator coverage remains unverified (Java was unavailable in the preceding run). This session tested actual deployed rules with isolated live fixtures instead. Provision Java via `.gitlab/duo/agent-config.yml` for future emulator testing.
- Local Webpack cache path-case warnings did not fail compilation. All checks listed above passed in this session. The pre-existing local change to `.env.example` was left untouched and excluded from commits.
