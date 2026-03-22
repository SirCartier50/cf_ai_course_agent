export interface Env {
  AI: Ai;
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  SYLLABUS_PARSE_WORKFLOW: Workflow;
  QUESTION_TRIAGE_WORKFLOW: Workflow;
}
