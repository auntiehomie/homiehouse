export type DemoParticipantId = 'demo-account-a' | 'demo-account-b';

export type DemoMessage = {
  id: string;
  conversationId: string;
  senderId: DemoParticipantId;
  recipientId: DemoParticipantId;
  text: string;
  createdAt: number;
};

export type SendDemoMessageInput = {
  senderId: DemoParticipantId;
  recipientId: DemoParticipantId;
  text: string;
};

/** Transport contract that can later be implemented by a Hypersnap adapter. */
export interface DirectMessageTransport {
  listMessages(participantA: DemoParticipantId, participantB: DemoParticipantId): DemoMessage[];
  sendMessage(input: SendDemoMessageInput): DemoMessage;
}

/**
 * In-memory, same-tab transport for preview UI testing only.
 * It does not encrypt, persist, or transmit message contents.
 */
export class LocalPreviewDirectMessageTransport implements DirectMessageTransport {
  private messages: DemoMessage[] = [];
  private nextId = 1;

  constructor(private readonly now: () => number = Date.now) {}

  listMessages(participantA: DemoParticipantId, participantB: DemoParticipantId): DemoMessage[] {
    const conversationId = getDemoConversationId(participantA, participantB);
    return this.messages
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
      .map(message => ({ ...message }));
  }

  sendMessage({ senderId, recipientId, text }: SendDemoMessageInput): DemoMessage {
    const normalizedText = text.trim();
    if (!normalizedText) throw new Error('Message cannot be empty.');
    if (normalizedText.length > 500) throw new Error('Messages are limited to 500 characters in this preview.');
    if (senderId === recipientId) throw new Error('Choose the other demo account as the recipient.');

    const message: DemoMessage = {
      id: `local-${this.nextId++}`,
      conversationId: getDemoConversationId(senderId, recipientId),
      senderId,
      recipientId,
      text: normalizedText,
      createdAt: this.now(),
    };
    this.messages.push(message);
    return { ...message };
  }
}

export function getDemoConversationId(a: DemoParticipantId, b: DemoParticipantId): string {
  return [a, b].sort().join(':');
}
