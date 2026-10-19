# Learning from conversations

Casts in feed cards and cast detail expose **Explain in plain English** and **Build me a lesson**. Explain opens Ask Homie and starts one explanation after the matching chat history loads. Lesson opens a topic field so learners can choose the specific idea before generating. Ask Homie can switch either direction and retains the exchange for follow-up questions. The Learning Hub also links to this flow; its question panel uses the contextual explanation path.

The API accepts `learningMode: explain | lesson`, optional `learningTopic` (200 characters), and bounded user/assistant history. It uses the existing `llmChat` provider chain, rather than the legacy `learn` intent that coaches cast-writing habits. Known cast hashes resolve through Hypersnap; generation includes the selected cast, up to six parent excerpts and eight available replies. Node failure falls back to the supplied excerpt. These are explicitly partial thread excerpts.

Relevant cached knowledge-base summaries and learning points supply background. Supporting HTTPS sources are returned as metadata and displayed separately. This path does not perform live web verification. System guidance distinguishes cast opinions from established concepts, treats retrieved content as data, and disallows invented citations or claims of live research. A complete lesson asks for learning objectives, three concept sections, an analogy, worked example, a no-spend exercise and three checks with separate answers. Generated answers remain model output and are not independently fact-checked.

Conversation snapshots retain answers, drafts, learning mode and topic through the existing account/cast-scoped cache. Returning or refreshing an existing conversation does not automatically regenerate the explanation. URL parameters are parsed once, preserving percent signs and Unicode. Lessons live in chat history; this does not create curriculum modules or award completion/HH2 rewards. Existing Pro course entitlements are unchanged.

## Validation

- 284 Jest tests across 53 suites pass, including canonical-thread context, follow-ups, provider failure, safe source links, percent/Unicode URL transport, learning API routing and request validation.
- TypeScript passes; changed-source ESLint has zero errors (existing warnings); whitespace check passes.
- Next production build exits successfully and creates `.next/BUILD_ID`.
- Phone/tablet/desktop browser fixtures cover explanation, chosen-topic lesson, follow-up, refresh persistence and overflow. They could not run: Chromium is missing and the browser download is truncated. These UI checks remain unverified.
- No live AI/KB end-to-end check: provider/database credentials are absent locally. No live posts, payments, migrations or production deployment were performed.
