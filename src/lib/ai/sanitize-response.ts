const INTERNAL_TOOL_MARKUP = /<(?:function_calls\b|invoke\s+name=["'](?:get_user_casts|search_farcaster_casts)["']|parameter\s+name=["'](?:username|query)["'])/i;

export const TOOL_MARKUP_FALLBACK =
  "I couldn't complete a reliable live cast lookup, so I can't verify this from the live social feed right now. Please try again, or give me a specific username or search phrase.";

/** Keep model-emitted pseudo tool calls out of the chat UI and share actions. */
export function sanitizeAssistantResponse(content: unknown): string {
  if (typeof content !== 'string') return '';
  return INTERNAL_TOOL_MARKUP.test(content) ? TOOL_MARKUP_FALLBACK : content;
}
