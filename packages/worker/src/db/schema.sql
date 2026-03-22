-- Users (accounts that log in)
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'professor', 'ta')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id             TEXT PRIMARY KEY,
  code           TEXT NOT NULL,
  title          TEXT NOT NULL,
  term           TEXT NOT NULL,
  professor_id   TEXT NOT NULL REFERENCES users(id),
  course_key     TEXT NOT NULL UNIQUE,
  agent_rules    TEXT,
  agent_persona  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pre-populated student roster (professor provides emails at course creation)
-- Each student gets a unique student_course_id they use to enroll
CREATE TABLE IF NOT EXISTS course_students (
  id                TEXT PRIMARY KEY,
  course_id         TEXT NOT NULL REFERENCES courses(id),
  student_course_id TEXT NOT NULL UNIQUE,
  email             TEXT NOT NULL,
  user_id           TEXT REFERENCES users(id),
  enrolled          INTEGER NOT NULL DEFAULT 0,
  enrolled_at       TEXT,
  UNIQUE(course_id, email)
);

-- TAs added by professor
CREATE TABLE IF NOT EXISTS course_tas (
  id        TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  user_id   TEXT NOT NULL REFERENCES users(id),
  added_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(course_id, user_id)
);

-- Syllabus (parsed structured data)
CREATE TABLE IF NOT EXISTS syllabi (
  id         TEXT PRIMARY KEY,
  course_id  TEXT NOT NULL UNIQUE REFERENCES courses(id),
  raw_text   TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'parsing', 'parsed', 'error')),
  parsed_at  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS syllabus_deadlines (
  id          TEXT PRIMARY KEY,
  syllabus_id TEXT NOT NULL REFERENCES syllabi(id),
  title       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('assignment', 'exam', 'quiz', 'project', 'other')),
  due_date    TEXT NOT NULL,
  weight      REAL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS syllabus_policies (
  id          TEXT PRIMARY KEY,
  syllabus_id TEXT NOT NULL REFERENCES syllabi(id),
  category    TEXT NOT NULL CHECK (category IN (
    'late_work', 'attendance', 'academic_integrity',
    'makeup_exam', 'grading_scale', 'extra_credit', 'other'
  )),
  policy_text TEXT NOT NULL,
  conditions  TEXT
);

CREATE TABLE IF NOT EXISTS syllabus_office_hours (
  id          TEXT PRIMARY KEY,
  syllabus_id TEXT NOT NULL REFERENCES syllabi(id),
  instructor  TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  location    TEXT,
  is_virtual  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS syllabus_grading_weights (
  id          TEXT PRIMARY KEY,
  syllabus_id TEXT NOT NULL REFERENCES syllabi(id),
  component   TEXT NOT NULL,
  weight      REAL NOT NULL,
  drop_lowest INTEGER DEFAULT 0
);

-- Conversations & Messages
CREATE TABLE IF NOT EXISTS conversations (
  id              TEXT PRIMARY KEY,
  course_id       TEXT NOT NULL REFERENCES courses(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_message_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  tool_calls      TEXT,
  metadata        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id                 TEXT PRIMARY KEY,
  course_id          TEXT NOT NULL REFERENCES courses(id),
  student_id         TEXT NOT NULL REFERENCES users(id),
  conversation_id    TEXT REFERENCES conversations(id),
  category           TEXT NOT NULL CHECK (category IN (
    'makeup_request', 'grade_dispute', 'extension_request',
    'clarification', 'accommodation', 'other'
  )),
  subject            TEXT NOT NULL,
  description        TEXT NOT NULL,
  agent_summary      TEXT,
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'awaiting_student', 'resolved', 'denied'
  )),
  priority           TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to        TEXT REFERENCES users(id),
  professor_response TEXT,
  resolved_at        TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Knowledge Base (resolved Q&A for reuse)
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id          TEXT PRIMARY KEY,
  course_id   TEXT NOT NULL REFERENCES courses(id),
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('syllabus', 'professor', 'ticket_resolution')),
  source_id   TEXT,
  approved    INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Student Profiles (per-course learning context)
CREATE TABLE IF NOT EXISTS student_profiles (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  course_id       TEXT NOT NULL REFERENCES courses(id),
  struggle_topics TEXT,
  question_count  INTEGER NOT NULL DEFAULT 0,
  last_active     TEXT,
  risk_score      REAL DEFAULT 0,
  UNIQUE(user_id, course_id)
);

-- Analytics Events
CREATE TABLE IF NOT EXISTS analytics_events (
  id         TEXT PRIMARY KEY,
  course_id  TEXT NOT NULL REFERENCES courses(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'question_asked', 'question_answered', 'question_escalated',
    'ticket_created', 'ticket_resolved', 'syllabus_parsed',
    'deadline_reminder_sent', 'grade_scenario_calculated'
  )),
  user_id    TEXT REFERENCES users(id),
  metadata   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Course Materials (lecture notes, slides, resources, announcements)
CREATE TABLE IF NOT EXISTS course_materials (
  id          TEXT PRIMARY KEY,
  course_id   TEXT NOT NULL REFERENCES courses(id),
  title       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('lecture_notes', 'slides', 'resource', 'announcement')),
  content     TEXT NOT NULL,
  week_number INTEGER,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_materials_course ON course_materials(course_id, type);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_course_students_course ON course_students(course_id);
CREATE INDEX IF NOT EXISTS idx_course_students_email ON course_students(email);
CREATE INDEX IF NOT EXISTS idx_course_students_user ON course_students(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_course_status ON tickets(course_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_student ON tickets(student_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_date ON syllabus_deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_analytics_course_type ON analytics_events(course_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_course ON knowledge_entries(course_id, approved);
CREATE INDEX IF NOT EXISTS idx_student_profiles_risk ON student_profiles(course_id, risk_score DESC);
