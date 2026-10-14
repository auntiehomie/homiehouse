import { isXAiReplyAutomationApproved } from '@/lib/x-automation-policy';

describe('X AI reply approval', () => {
  it('fails closed unless both independent opt-ins are true', () => {
    expect(isXAiReplyAutomationApproved({})).toBe(false);
    expect(isXAiReplyAutomationApproved({ X_AGENT_ENABLED: 'true' })).toBe(false);
    expect(isXAiReplyAutomationApproved({ X_AI_REPLY_APPROVAL_CONFIRMED: 'true' })).toBe(false);
    expect(isXAiReplyAutomationApproved({
      X_AGENT_ENABLED: 'true',
      X_AI_REPLY_APPROVAL_CONFIRMED: 'false',
    })).toBe(false);
  });

  it('requires both opt-ins to be explicitly true', () => {
    expect(isXAiReplyAutomationApproved({
      X_AGENT_ENABLED: 'true',
      X_AI_REPLY_APPROVAL_CONFIRMED: 'true',
    })).toBe(true);
  });
});
