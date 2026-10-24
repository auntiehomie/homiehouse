# Learning Hub animation implementation and next steps

## Decision
Use React state and CSS Modules for the first release. No library installs or changes to package.json/lockfile are required. Animate only opacity and transform for 280ms, on explicit stage selection or replay. No timers, autoplay, network calls, generated video, or animation assets. Text remains selectable and screen-reader accessible. This is a staged lesson walkthrough, not a simulation or proof that the lesson's claims are correct.

Sources reviewed:
- https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion
- https://motion.dev/docs/react-lazy-motion
- https://motion.dev/docs/react-reduce-bundle-size

## Library options
| Option | Install | Use |
| --- | --- | --- |
| React + CSS Modules | None; existing stack | Selected: short reveals, responsive layout, manual sequencing |
| Motion | `npm install motion` | Future coordinated transitions; use LazyMotion/m with asynchronously loaded features and reduced-motion policy; measure actual production bundle first |
| Video/asset animation runtime | None planned | Adds authoring, downloading and accessibility work; unnecessary for text-grounded walkthroughs |

## Implemented code sequence
1. Add `src/components/learning/LessonWalkthrough.tsx`. Derive stages directly from the loaded LessonContent: intro, concepts with explicitly labelled analogies, practical example, quick actions, summary. Exclude quiz questions and answers. No keyword-based diagrams or invented causal relationships.
2. Add `LessonWalkthrough.module.css`. Display wrapped stage buttons on narrow containers and stage navigation beside the explanation above 680px of available space. Use a brief transform/opacity reveal only under prefers-reduced-motion: no-preference. Long content wraps and remains in the reader's existing scroll area.
3. Add explicit open/close, stage selection, Previous, Next and Replay reveal controls, boundary disabling, focus indicators and a concise live status. No autoplay, so learners control their reading time. Stop touch propagation so interacting with the walkthrough does not swipe the parent lesson card.
4. Update `src/app/learn/module/page.tsx` to retain already-loaded lesson data in state on cached, network and verification-retry paths. Render the walkthrough inside the introduction card. It makes no additional lesson requests and does not change quiz gating, rewards or progress.
5. Validate the diff, preview and production build before merge. Required UI cases: 390/768/1366/1920px, browser zoom, long titles/explanations, empty concepts, keyboard-only use, screen reader status, reduced motion, touch controls, cached/network lesson loading, reward verification retry. This environment lacks a working Chromium install and repository dependencies; build and browser verification must run in CI/Preview.

## Next phase: accurate explanatory diagrams
1. Prioritize specific reviewed lessons (encryption sender/relay/recipient, wallet signing, or transaction approvals). Start with one authored diagram per lesson rather than classifying arbitrary AI prose into diagrams.
2. Define a versioned optional visual schema: stable lesson/concept IDs, labelled entities, authored steps, source references, caveats and an equivalent static text description. Validate it server-side; unknown/invalid schemas fall back to this text walkthrough.
3. Have a subject reviewer verify every step against primary sources, including what the picture omits. Encryption diagrams must distinguish encrypted content from visible metadata; signing diagrams must distinguish signatures from encryption.
4. Render semantic HTML/SVG, animating wrappers, with manual Next/Previous and Replay. Never interpolate raw generated HTML/SVG or execute generated animation code. Lazy-load any richer renderer only when opened.
5. Profile actual production bundles, interaction responsiveness and frame performance on desktop and phone. Adopt Motion only if measured coordination benefits justify it. Never increase animation complexity merely to fill space.
6. Evaluate learning quality with optional comprehension feedback and existing quiz results; animation is not assumed to improve learning. Do not award extra progress for opening or replaying a visual.

## Validation status
Whitespace/source review performed locally. Production typecheck, lint and browser verification remain pending; no claim of measured performance or improved comprehension is made.
