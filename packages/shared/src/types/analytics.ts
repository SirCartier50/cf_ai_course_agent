export type AnalyticsEventType =
  | 'question_asked'
  | 'question_answered'
  | 'question_escalated'
  | 'ticket_created'
  | 'ticket_resolved'
  | 'syllabus_parsed'
  | 'deadline_reminder_sent'
  | 'grade_scenario_calculated';

export interface AnalyticsEvent {
  id: string;
  course_id: string;
  event_type: AnalyticsEventType;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CourseOverview {
  total_questions: number;
  auto_resolved: number;
  auto_resolved_pct: number;
  open_tickets: number;
  at_risk_students: number;
  trending_topics: TrendingTopic[];
}

export interface TrendingTopic {
  topic: string;
  count: number;
  sample_questions: string[];
}

export interface AtRiskStudent {
  user_id: string;
  name: string;
  email: string;
  risk_score: number;
  question_count: number;
  struggle_topics: string[];
}

export interface KnowledgeEntry {
  id: string;
  course_id: string;
  question: string;
  answer: string;
  source: 'syllabus' | 'professor' | 'ticket_resolution';
  source_id: string | null;
  approved: boolean;
  usage_count: number;
  created_at: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  course_id: string;
  struggle_topics: string[];
  question_count: number;
  last_active: string | null;
  risk_score: number;
}
