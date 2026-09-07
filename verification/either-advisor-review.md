# Either-advisor project-document review

## Definition of Done

- Proposal, Proposal Defense (`chapter3`), and Final Book (`chapter5`) appear in the pending queue of the student's current main advisor and both optional co-advisors.
- Any one of these advisors can record approval or rejection without another advisor's signature. The actual reviewer is recorded; the submission leaves every advisor's pending queue. Rejection allows resubmission; chapter3 approval unlocks QE and chapter5 submission; chapter5 approval sets its passed flag.
- Queue membership follows current assignments, not the historical main-advisor snapshot on an uploaded document. Empty/unrelated IDs do not receive pending entries; duplicate advisor slots do not duplicate documents.
- The dashboard and document manager use the same advisor-membership rule. The manager explicitly explains single-advisor review. Existing committee review behavior is preserved; student/admin views do not gain review controls.
- Project tests, TypeScript checking and production build run successfully. Changes are committed, pushed and linked in a draft merge request.

## Changes

`isProjectAdvisor` centralizes current main/co-advisor membership. `getPendingProjectDocuments(advisorId)` uses the live student record; the teacher dashboard now consumes that filtered query instead of separately combining historical document ownership with current advisees. Review writes already record a single reviewer and update stage flags atomically, so their semantics and the existing committee review path are unchanged.

## Verification executed

- `npm test` — exit 0. Existing rules, password, auth, documents, media/persistence and realtime tests passed. Document tests now run main/co-advisor-1/co-advisor-2 × all three stages, including rejection feedback, resubmission, single approval, reviewer identity, shared-queue removal and downstream prerequisites. Additional cases exercise reassignment, empty/custom IDs and duplicate slots.
- Real `ProjectDocumentsManager` rendering is checked with React server rendering in `scripts/test-documents.js` for each advisor/stage, reviewer attribution, single-review guidance, student/admin read-only controls and the pre-existing committee path.
- `npm run typecheck` — exit 0.
- `npm run build` — exit 0; Next.js compiled and generated all four static pages. Non-fatal webpack cache warnings concern Windows drive-letter casing.

Tests use the real store with cloud writes disabled; existing persistence/realtime tests use controlled SDK I/O. Browser clicks, live Firebase writes and production deployment for this change were **not verified** or performed. No database security rules were changed; this is not a server-side authorization hardening change.

## Integration scope

The workspace started at `06a7025` on `duo/fix/first-login-project-documents`, eight commits ahead of `main`. This change is a stacked draft MR targeting that existing remote branch to avoid mixing the earlier work into this diff. Pre-existing local changes outside this task were left untouched.
