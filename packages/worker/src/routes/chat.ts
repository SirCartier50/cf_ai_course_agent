import { Hono } from 'hono';
import type { Env } from '../env';
import { requireAuth, requireRole } from '../middleware/auth';
import { runAgent } from '../services/agent';

export const chatRoutes = new Hono<{ Bindings: Env }>();

chatRoutes.use('*', requireAuth());

chatRoutes.post('/:courseId/chat', requireRole('student'), async (c) => {
  const courseId = c.req.param('courseId');
  const userId = c.get('userId');
  const { message, conversation_id } = await c.req.json();

  if (!message) {
    return c.json({ error: 'message is required' }, 400);
  }

  const enrolled = await c.env.DB.prepare(
    'SELECT id FROM course_students WHERE course_id = ? AND user_id = ? AND enrolled = 1'
  ).bind(courseId, userId).first();

  if (!enrolled) {
    return c.json({ error: 'Not enrolled in this course' }, 403);
  }

  let convId = conversation_id;
  if (!convId) {
    convId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO conversations (id, course_id, user_id) VALUES (?, ?, ?)'
    ).bind(convId, courseId, userId).run();
  }

  const userMsgId = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
  ).bind(userMsgId, convId, 'user', message).run();

  await c.env.DB.prepare(
    'UPDATE conversations SET last_message_at = datetime(\'now\') WHERE id = ?'
  ).bind(convId).run();

  let agentResponse;
  try {
    agentResponse = await runAgent({
      env: c.env,
      courseId,
      userId,
      conversationId: convId,
      userMessage: message,
    });
  } catch (err: any) {
    console.error('Agent error:', err?.message || err);
    agentResponse = {
      content: "I'm sorry, I encountered an error processing your question. Please try again in a moment.",
      toolCalls: undefined,
      metadata: { escalated: false, sources: [] },
    };
  }

  const assistantMsgId = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO messages (id, conversation_id, role, content, tool_calls, metadata) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(
    assistantMsgId,
    convId,
    'assistant',
    agentResponse.content,
    agentResponse.toolCalls ? JSON.stringify(agentResponse.toolCalls) : null,
    agentResponse.metadata ? JSON.stringify(agentResponse.metadata) : null,
  ).run();

  await c.env.DB.prepare(
    'INSERT INTO analytics_events (id, course_id, event_type, user_id, metadata) VALUES (?, ?, ?, ?, ?)'
  ).bind(
    crypto.randomUUID(),
    courseId,
    agentResponse.metadata?.escalated ? 'question_escalated' : 'question_answered',
    userId,
    JSON.stringify({ confidence: agentResponse.metadata?.confidence }),
  ).run();

  await c.env.DB.prepare(
    `UPDATE student_profiles
     SET question_count = question_count + 1, last_active = datetime('now')
     WHERE user_id = ? AND course_id = ?`
  ).bind(userId, courseId).run();

  return c.json({
    conversation_id: convId,
    message: {
      id: assistantMsgId,
      role: 'assistant',
      content: agentResponse.content,
      tool_calls: agentResponse.toolCalls,
      metadata: agentResponse.metadata,
    },
  });
});

chatRoutes.get('/:courseId/chat/history', async (c) => {
  const courseId = c.req.param('courseId');
  const userId = c.get('userId');
  const conversationId = c.req.query('conversation_id');

  if (!conversationId) {
    const conversations = await c.env.DB.prepare(
      'SELECT * FROM conversations WHERE course_id = ? AND user_id = ? ORDER BY last_message_at DESC'
    ).bind(courseId, userId).all();

    return c.json({ conversations: conversations.results });
  }

  const messages = await c.env.DB.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).bind(conversationId).all();

  return c.json({ messages: messages.results });
});
