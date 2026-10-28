import { sanitizeAssistantResponse, TOOL_MARKUP_FALLBACK } from '@/lib/ai/sanitize-response';

describe('sanitizeAssistantResponse', () => {
  it('replaces pseudo tool calls with a clear fallback', () => {
    expect(sanitizeAssistantResponse('<function_calls><invoke name="get_user_casts">'))
      .toBe(TOOL_MARKUP_FALLBACK);
  });

  it('preserves normal assistant content', () => {
    expect(sanitizeAssistantResponse('Here is what I found.')).toBe('Here is what I found.');
  });
});
