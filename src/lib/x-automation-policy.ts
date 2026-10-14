/**
 * Independent opt-in for AI-generated X mention replies.
 * X_AGENT_ENABLED alone never authorizes automated AI replies.
 */
export function isXAiReplyAutomationApproved(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.X_AGENT_ENABLED === 'true' && env.X_AI_REPLY_APPROVAL_CONFIRMED === 'true';
}
