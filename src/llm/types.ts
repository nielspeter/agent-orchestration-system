export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: Array<ContentBlock>;
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

export interface ToolUse {
  name: string;
  input: Record<string, unknown>;
}

export interface LLMProvider {
  complete(messages: ConversationMessage[]): Promise<ConversationMessage>;
}