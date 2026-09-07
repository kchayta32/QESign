# Group project documents and teacher feedback

## Behaviour

- Student profile: NW is no longer selectable. A legacy NW profile must explicitly select a replacement (no silent reassignment). Co-advisor 1's label omits “(ถ้ามี)”; a third co-advisor supports registered/custom/empty assignments and advisor queues.
- Numeric `11-digit-code@ssru.ac.th` emails resolve to the existing student account. The previous `s<code>@ssru.ac.th` alias and code login remain valid. The form selects student automatically, and the auth service rejects mismatched selected roles before creating a session. Password and roster checks still apply.
- First document upload records the submitting student plus entered roster members. Membership is frozen across Proposal, Proposal Defense and Final Book. Any member can submit the next revision; all members see the same PDF, review, attachments, status and history. A single review updates all applicable member exam flags; QE bookings/results remain individual.
- Revision 0 is the first submission; version 2 is “แก้ไขครั้งที่ 1”, etc. Rejections permit repeated revisions without a retry-count limit. Pending/approved documents still cannot be duplicated. Prior reviewed PDFs and feedback/attachments remain available in history.
- Project-review comments and QE examiner comments auto-grow, preserve multiline content and reflow when width changes. There is no application character or textarea-height cap. The underlying RTDB string/request limits still apply; this is not infinite storage.
- Project reviews accept up to five PDF/PNG/JPEG/WebP attachments, each <=5 MiB. SVG/HTML, empty, oversized and mismatched file content are rejected. Metadata and file bytes are persisted atomically; bytes are fetched on demand, images are previewable/downloadable and PDFs downloadable.

## Data and rollout

Deploy `database.rules.json` together with the application. New nodes under `ssru_ce`:

- `projectGroups/<groupId>`: canonical membership, immutable roster identity.
- `projectMemberships/<studentId>`: group claim (prevents overlapping registrations).
- `documentSlots/<groupId>_<stage>`: compare-and-set pointer preventing simultaneous duplicate revisions.
- `reviewFiles/<documentId>/<attachmentId>`: attachment bytes, excluded from collection subscriptions and localStorage.

Documents gain optional `groupId`, `memberIds` and `reviewAttachments`; students gain optional `coAdvisor3Id`. Legacy individual records remain readable and retain their existing eligibility behaviour. Students with existing individual history cannot claim other students' history by forming a new group: historical regrouping needs an explicit, separately reviewed data migration. Withdrawing an unreviewed upload does not release the registered group. No live data migration, rule deployment or production release was performed.

This change retains the repository's existing authentication and database access policy; it is not an authorization-hardening migration.

## Verification commands

Normal project checks:

```shell
npm ci
npm run typecheck
npm test
npm run build
```

Additional checks use Java 21, Firebase RTDB emulator v4.11.2, Chrome and optional test-only `esbuild@0.25.12` (not a production dependency). After a build, run:

```shell
node -r ./scripts/register-ts.js scripts/run-database-group-check.js <java-executable> <database-emulator.jar> --ui
```

The runner starts an isolated emulator bound to 127.0.0.1:9000, installs/compiles the real database rules, tests real writes, then runs Chrome against production React components and the real store. Browser requests to external HTTPS services are blocked. Ports 9000, 9100 and 9334 must be available. Set `CHROME_PATH` if Chrome is installed elsewhere.

### Observed in this session (2026-09-07)

- `npm ci` in the original Windows directory failed with EPERM during dependency cleanup; a retry/install also failed to complete. A clean temporary workspace containing the same explicit source/config/package files was used instead (no environment/secret files copied).
- Fresh temporary-workspace `npm ci --ignore-scripts --no-audit --no-fund --prefer-offline` succeeded. `npm run typecheck`, **all** `npm test` suites, and `npm run build` succeeded there.
- The media test's exact atomic-write assertions were expanded to include the new group/membership/stage-slot writes (not removed or weakened).
- Real emulator compiled the rules and passed atomic membership/review-file checks, invalid-write rejection, two simultaneous revision submissions (one winner, no orphan PDF), and group approval/revocation.
- Chrome passed role auto-detection, legacy NW handling, third co-advisor save/reopen/clear, large pasted comments at 1280px and 390px, real image rendering, byte-identical PDF download, a different member's revision, and retained historical attachments. No uncaught browser exceptions were recorded.
- Java was not on PATH; the working Java 21 runtime was found at `C:/Program Files/Android/Android Studio1/jbr/bin/java.exe`. A separate JRE download attempt timed out and was not used.
- UI checks run production components in a test entry against the emulator, not a deployed production site. Production deployment remains **unverified**. Provision reproducible runtime tooling through `.gitlab/duo/agent-config.yml` where needed.

## GitLab delivery blocker

GitLab API returned `403 Forbidden - Your account has been blocked.` Remote Git authentication also failed (`HTTP Basic: Access denied`). No remote merge request or production deployment can be claimed from those failures. Local changes and verification are retained for delivery once access is restored.
