export type MessageRole = 'user' | 'assistant' | 'system';

export interface Conversation {
  id: string;
  course_id: string;
  user_id: string;
  started_at: string;
  last_message_at: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  tool_calls: ToolCall[] | null;
  metadata: MessageMetadata | null;
  created_at: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

export interface MessageMetadata {
  confidence?: number;
  sources?: string[];
  escalated?: boolean;
  ticket_id?: string;
}

export interface ChatInput {
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  message: Message;
  conversation_id: string;
}
