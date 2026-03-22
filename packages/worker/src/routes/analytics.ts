import { Hono } from 'hono';
import type { Env } from '../env';
import { requireAuth, requireRole } from '../middleware/auth';

export const analyticsRoutes = new Hono<{ Bindings: Env }>();

analyticsRoutes.use('*', requireAuth());
analyticsRoutes.use('*', requireRole('professor', 'ta'));

// Course overview stats
analyticsRoutes.get('/:courseId/analytics/overview', async (c) => {
  const courseId = c.req.param('courseId');

  const [totalQuestions, autoResolved, escalated, openTickets, atRiskStudents] = await Promise.all([
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM analytics_events WHERE course_id = ? AND event_type = 'question_asked'"
    ).bind(courseId).first<{ count: number }>(),

    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM analytics_events WHERE course_id = ? AND event_type = 'question_answered'"
    ).bind(courseId).first<{ count: number }>(),

    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM analytics_events WHERE course_id = ? AND event_type = 'question_escalated'"
    ).bind(courseId).first<{ count: number }>(),

    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM tickets WHERE course_id = ? AND status = 'open'"
    ).bind(courseId).first<{ count: number }>(),

    c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM student_profiles WHERE course_id = ? AND risk_score > 0.6'
    ).bind(courseId).first<{ count: number }>(),
  ]);

  const total = (totalQuestions?.count || 0);
  const resolved = (autoResolved?.count || 0);

  return c.json({
    total_questions: total,
    auto_resolved: resolved,
    auto_resolved_pct: total > 0 ? Math.round((resolved / total) * 100) : 0,
    open_tickets: openTickets?.count || 0,
    at_risk_students: atRiskStudents?.count || 0,
  });
});

// At-risk students
analyticsRoutes.get('/:courseId/analytics/at-risk', async (c) => {
  const courseId = c.req.param('courseId');

  const students = await c.env.DB.prepare(
    `SELECT sp.*, u.name, u.email
     FROM student_profiles sp
     JOIN users u ON sp.user_id = u.id
     WHERE sp.course_id = ? AND sp.risk_score > 0.3
     ORDER BY sp.risk_score DESC`
  ).bind(courseId).all();

  return c.json({ students: students.results });
});

// Trending questions (recent questions grouped by similarity)
analyticsRoutes.get('/:courseId/analytics/trending', async (c) => {
  const courseId = c.req.param('courseId');

  // Get recent questions from messages
  const recent = await c.env.DB.prepare(
    `SELECT m.content, m.created_at
     FROM messages m
     JOIN conversations cv ON m.conversation_id = cv.id
     WHERE cv.course_id = ? AND m.role = 'user'
     ORDER BY m.created_at DESC
     LIMIT 50`
  ).bind(courseId).all();

  return c.json({ recent_questions: recent.results });
});
