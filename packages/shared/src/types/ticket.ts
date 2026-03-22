export type TicketCategory =
  | 'makeup_request'
  | 'grade_dispute'
  | 'extension_request'
  | 'clarification'
  | 'accommodation'
  | 'other';

export type TicketStatus = 'open' | 'in_progress' | 'awaiting_student' | 'resolved' | 'denied';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Ticket {
  id: string;
  course_id: string;
  student_id: string;
  conversation_id: string | null;
  category: TicketCategory;
  subject: string;
  description: string;
  agent_summary: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  professor_response: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketInput {
  course_id: string;
  student_id: string;
  conversation_id?: string;
  category: TicketCategory;
  subject: string;
  description: string;
  agent_summary?: string;
}

export interface ResolveTicketInput {
  status: TicketStatus;
  professor_response: string;
  absorb_to_knowledge_base?: boolean;
}
