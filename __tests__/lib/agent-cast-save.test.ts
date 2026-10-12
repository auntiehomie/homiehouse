import { isSaveCastCommand } from '@/lib/agent-cast-save';

describe('@thehomie cast save command', () => {
  it.each(['save', 'save this', 'save that cast', 'bookmark this post', 'please save this cast!'])(
    'recognizes explicit command: %s',
    (text) => {
      expect(isSaveCastCommand(text)).toBe(true);
    },
  );

  it.each(['save my notes', 'I want to save this', 'please save this idea for later'])(
    'does not treat a sentence as a command: %s',
    (text) => {
      expect(isSaveCastCommand(text)).toBe(false);
    },
  );
});
