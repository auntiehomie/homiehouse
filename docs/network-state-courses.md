# Balanced Network State courses

Entry: `/learn/network-states`, linked from the Learning Hub and Learning Library.

Four free modules progress from beginner to advanced:

1. Can an Online Community Become a Country?
2. Who Makes the Rules?
3. Freedom for Whom?
4. Build New Systems, Improve Existing Ones, or Both?

The curriculum is authored in `src/lib/network-state-curriculum.ts`. Each module pairs the proposal with critical or alternative perspectives, linked sources, a fictional exercise, reflection actions, and three objective quiz questions. Agreement with a political position is not graded. The shared curated registry serves both public reading pages and the lesson API, so model availability cannot drop the counterpoints.

## Reading boundaries

- Balaji's two shorter readings overlap the book; they are not independent confirmation.
- Vitalik's review is constructive and qualified, rather than simple endorsement or rejection.
- The Blockchain Socialist / Primavera De Filippi resource is summarized only from its written introduction. Do not attribute unverified audio claims to the speakers.
- Modular Politics is used as a proposed alternative framework based on its abstract. It predates the book and is not a direct response or empirical proof of better outcomes.
- Exercises are fictional. No claim is made about the current legal status or measured local impact of a real development.

## Interaction and progress

Public pages require no login. The start control requests the fixed plan through POST `/api/learning-plan`, writes it as the active browser plan, and opens the existing lesson player. It preserves completion records. Authenticated starts append missing canonical modules to the server's existing reward assignment, retaining earlier modules and reward events. A database failure returns a retryable 503. Completion and reward eligibility continue through the existing verification flow; production database and reward claims were not exercised locally.

Source links remain available from the interactive player's header. The player skips absent analogy cards and identifies these examples as fictional rather than real events. The new course summary does not use the generic model-generation attribution.

## Validation

- All 60 Jest suites / 318 tests pass, including guest plan/lesson APIs with no AI provider, authenticated assignment behavior, and database failure handling.
- TypeScript passes; changed-source ESLint has zero errors (existing warnings).
- Production build passes.
- All three Playwright scenarios passed locally against a production build using separately packaged Chromium 153: 390px and 1280px real catalog-to-quiz flows, plus failure/retry with progress retention. The migration guide preference and quiz locator were corrected in the tests. Playwright's matching Chromium 156 download remains unavailable here; CI should still verify its bundled browser. Installation and limitations: docs/local-chromium-testing.md.

Deployment requires PR review and merge. Knowledge-base ingestion remains separate from these fixed courses.
