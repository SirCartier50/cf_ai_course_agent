import { Hono } from 'hono';
import type { Env } from '../env';
import { requireAuth, requireRole } from '../middleware/auth';

export const ticketRoutes = new Hono<{ Bindings: Env }>();

ticketRoutes.use('*', requireAuth());

ticketRoutes.get('/:courseId/tickets', requireRole('professor', 'ta'), async (c) => {
  const courseId = c.req.param('courseId');
  const status = c.req.query('status');

  let query = `
    SELECT t.*, u.name as student_name, u.email as student_email
    FROM tickets t
    JOIN users u ON t.student_id = u.id
    WHERE t.course_id = ?
  `;
  const params: string[] = [courseId];

  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }

  query += ' ORDER BY t.created_at DESC';

  const tickets = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ tickets: tickets.results });
});

ticketRoutes.get('/:courseId/tickets/:ticketId', async (c) => {
  const ticketId = c.req.param('ticketId');

  const ticket = await c.env.DB.prepare(
    `SELECT t.*, u.name as student_name, u.email as student_email
     FROM tickets t
     JOIN users u ON t.student_id = u.id
     WHERE t.id = ?`
  ).bind(ticketId).first();

  if (!ticket) {
    return c.json({ error: 'Ticket not found' }, 404);
  }

  let messages = null;
  if (ticket.conversation_id) {
    const result = await c.env.DB.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).bind(ticket.conversation_id).all();
    messages = result.results;
  }

  return c.json({ ticket, messages });
});

ticketRoutes.patch('/:courseId/tickets/:ticketId', requireRole('professor', 'ta'), async (c) => {
  const ticketId = c.req.param('ticketId');
  const userId = c.get('userId');
  const { status, professor_response, absorb_to_knowledge_base } = await c.req.json();

  const ticket = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?')
    .bind(ticketId).first<{ id: string; course_id: string; description: string; conversation_id: string | null }>();

  if (!ticket) {
    return c.json({ error: 'Ticket not found' }, 404);
  }

  const updates: string[] = [];
  const values: (string | null)[] = [];

  if (status) {
    updates.push('status = ?');
    values.push(status);
    if (status === 'resolved' || status === 'denied') {
      updates.push('resolved_at = datetime(\'now\')');
    }
  }

  if (professor_response) {
    updates.push('professor_response = ?');
    values.push(professor_response);
  }

  updates.push('assigned_to = ?');
  values.push(userId);
  updates.push('updated_at = datetime(\'now\')');
  values.push(ticketId);

  await c.env.DB.prepare(
    `UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  if (absorb_to_knowledge_base && professor_response) {
    const kbId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO knowledge_entries (id, course_id, question, answer, source, source_id, approved) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(kbId, ticket.course_id, ticket.description, professor_response, 'ticket_resolution', ticketId, 1).run();
  }

  if (status === 'resolved') {
    await c.env.DB.prepare(
      'INSERT INTO analytics_events (id, course_id, event_type, user_id) VALUES (?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), ticket.course_id, 'ticket_resolved', userId).run();
  }

  return c.json({ updated: true });
});
