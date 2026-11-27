import { getCuratedLesson } from '@/lib/curated-curriculum';
import { LEARN_QUIZ_LESSON_ID, LEARN_QUIZ_PATH } from '@/lib/learn-quiz';
import type { SnapAction, SnapData } from '@/components/SnapRenderer';

const SNAP_MIME = 'application/vnd.farcaster.snap+json';
const LESSON_PATH = `/learn/library/${LEARN_QUIZ_LESSON_ID}`;
const TITLE = 'AI agent permissions quiz';

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function acceptsSnap(accept: string) {
  const media = accept.toLowerCase().split(',').map((entry) => {
    const [type, ...parameters] = entry.trim().split(';');
    const quality = parameters.map((part) => part.trim()).find((part) => part.startsWith('q='));
    return { type: type.trim(), quality: quality === undefined ? 1 : Number(quality.slice(2)) };
  });
  const snap = media.find(({ type }) => type === SNAP_MIME);
  return !!snap && snap.quality > 0 && media.every(({ quality }) => quality <= snap.quality);
}

export function GET(request: Request) {
  const question = getCuratedLesson(LEARN_QUIZ_LESSON_ID)?.quiz[0];
  if (!question) return new Response('Quiz unavailable', { status: 404 });

  const url = new URL(request.url);
  const options = question.options;
  const answer = url.searchParams.get('answer');
  const selected = options.findIndex((_, index) => String(index) === answer);
  const correct = selected === question.correctIndex;
  const feedback = correct ? 'Correct!' : `The answer is: ${options[question.correctIndex]}.`;
  const answerPath = (index: number) => `${LEARN_QUIZ_PATH}?answer=${index}`;
  const absolute = (path: string) => new URL(path, url.origin).href;
  const headers = new Headers({
    Vary: 'Accept',
    Link: `<${selected < 0 ? LEARN_QUIZ_PATH : answerPath(selected)}>; rel="alternate"; type="${SNAP_MIME}"`,
  });

  if (acceptsSnap(request.headers.get('accept') ?? '')) {
    const elements: SnapData['ui']['elements'] = {
      root: { type: 'stack', props: { gap: 'sm' }, children: [] },
    };
    const add = (id: string, element: SnapData['ui']['elements'][string]) => {
      elements[id] = element;
      elements.root.children?.push(id);
    };
    const addText = (id: string, content: string) => add(id, { type: 'text', props: { content } });
    const addButton = (id: string, label: string, action: SnapAction['action'], path: string) =>
      add(id, { type: 'button', props: { label }, on: { press: { action, params: { target: absolute(path) } } } });

    addText('question', question.question);
    if (selected < 0) {
      options.forEach((option, index) => {
        addText(`option-${index}`, `${index + 1}. ${option}`);
        addButton(`answer-${index}`, `Choose option ${index + 1}`, 'open_snap', answerPath(index));
      });
    } else {
      addText('feedback', feedback);
      addText('explanation', question.explanation);
      addButton('retry', 'Try again', 'open_snap', LEARN_QUIZ_PATH);
    }
    addButton('lesson', 'Continue lesson', 'open_url', LESSON_PATH);

    const snap: SnapData = { version: '2.0', theme: { accent: 'purple' }, ui: { root: 'root', elements } };
    headers.set('Content-Type', SNAP_MIME);
    return new Response(JSON.stringify(snap), { headers });
  }

  const questionHtml = escapeHtml(question.question);
  const body = selected < 0
    ? `<ol>${options.map((option, index) => `<li><a href="${answerPath(index)}">${escapeHtml(option)}</a></li>`).join('')}</ol>`
    : `<p><strong>${escapeHtml(feedback)}</strong></p><p>${escapeHtml(question.explanation)}</p><p><a href="${LEARN_QUIZ_PATH}">Try again</a></p>`;
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${TITLE} · Homiehouse</title>
  <meta property="og:title" content="${TITLE} · Homiehouse">
  <meta property="og:description" content="${questionHtml}">
  <style>
    :root { color-scheme: light dark; }
    body { font: 1.125rem/1.6 system-ui, sans-serif; margin: 0; }
    main { max-width: 36rem; margin: 3rem auto; padding: 0 1.25rem; }
    li a { display: inline-block; padding: .45rem 0; }
  </style>
</head>
<body><main><h1>${TITLE}</h1><p>${questionHtml}</p>${body}<p><a href="${LESSON_PATH}">Continue lesson</a></p></main></body>
</html>`, { headers });
}
