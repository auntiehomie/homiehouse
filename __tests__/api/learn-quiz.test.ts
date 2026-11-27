import { GET } from '@/app/learn/quiz/route';

const quizUrl = 'https://homiehouse.app/learn/quiz';
const snapMime = 'application/vnd.farcaster.snap+json';

describe('Learn Hub quiz Snap', () => {
  it('serves a discoverable browser preview and prefers higher-weight HTML', async () => {
    const response = GET(new Request(quizUrl, {
      headers: { Accept: `text/html, ${snapMime};q=0.5` },
    }));

    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(response.headers.get('Vary')).toBe('Accept');
    expect(response.headers.get('Link')).toContain(`rel="alternate"; type="${snapMime}"`);
    expect(await response.text()).toContain('Continue lesson');
  });

  it('follows the answer target to feedback and links to the source lesson', async () => {
    const headers = { Accept: snapMime };
    const response = GET(new Request(quizUrl, { headers }));
    expect(response.headers.get('Content-Type')).toBe(snapMime);
    const quiz = await response.json();
    const answer = quiz.ui.elements['answer-1'].on.press;
    expect(answer.action).toBe('open_snap');
    expect(quiz.ui.elements.feedback).toBeUndefined();

    const result = await GET(new Request(answer.params.target, { headers })).json();
    expect(result.ui.elements.feedback.props.content).toBe('Correct!');
    expect(result.ui.elements.explanation.props.content).toContain('least-permission');
    expect(result.ui.elements.lesson.on.press.params.target).toBe(
      'https://homiehouse.app/learn/library/agent-permissions-and-oversight',
    );
  });

  it('explains an incorrect choice and treats an invalid index as an unanswered quiz', async () => {
    const headers = { Accept: snapMime };
    const wrong = await GET(new Request(`${quizUrl}?answer=0`, { headers })).json();
    expect(wrong.ui.elements.feedback.props.content).toContain('Read public posts');
    const invalid = await GET(new Request(`${quizUrl}?answer=99`, { headers })).json();
    expect(invalid.ui.elements['answer-0']).toBeDefined();
  });
});
