export type SyllabusStatus = 'pending' | 'parsing' | 'parsed' | 'error';
export type DeadlineType = 'assignment' | 'exam' | 'quiz' | 'project' | 'other';
export type PolicyCategory =
  | 'late_work'
  | 'attendance'
  | 'academic_integrity'
  | 'makeup_exam'
  | 'grading_scale'
  | 'extra_credit'
  | 'other';

export interface Syllabus {
  id: string;
  course_id: string;
  raw_text: string;
  status: SyllabusStatus;
  parsed_at: string | null;
  created_at: string;
}

export interface Deadline {
  id: string;
  syllabus_id: string;
  title: string;
  type: DeadlineType;
  due_date: string;
  weight: number | null;
  description: string | null;
}

export interface Policy {
  id: string;
  syllabus_id: string;
  category: PolicyCategory;
  policy_text: string;
  conditions: Record<string, unknown> | null;
}

export interface OfficeHours {
  id: string;
  syllabus_id: string;
  instructor: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  location: string | null;
  is_virtual: boolean;
}

export interface GradingWeight {
  id: string;
  syllabus_id: string;
  component: string;
  weight: number;
  drop_lowest: number;
}

export interface ParsedSyllabus {
  syllabus: Syllabus;
  deadlines: Deadline[];
  policies: Policy[];
  office_hours: OfficeHours[];
  grading_weights: GradingWeight[];
}
