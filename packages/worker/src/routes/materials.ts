import { Hono } from 'hono';
import type { Env } from '../env';
import { requireAuth, requireRole } from '../middleware/auth';

export const materialRoutes = new Hono<{ Bindings: Env }>();

materialRoutes.use('*', requireAuth());

// Create a course material (professor or TA only)
materialRoutes.post('/:courseId/materials', requireRole('professor', 'ta'), async (c) => {
  const courseId = c.req.param('courseId');
  const { title, type, content, week_number } = await c.req.json();

  if (!title || !type || !content) {
    return c.json({ error: 'title, type, and content are required' }, 400);
  }

  const validTypes = ['lecture_notes', 'slides', 'resource', 'announcement'];
  if (!validTypes.includes(type)) {
    return c.json({ error: `type must be one of: ${validTypes.join(', ')}` }, 400);
  }

  // Verify course exists
  const course = await c.env.DB.prepare('SELECT id FROM courses WHERE id = ?').bind(courseId).first();
  if (!course) {
    return c.json({ error: 'Course not found' }, 404);
  }

  const materialId = crypto.randomUUID();

  await c.env.DB.prepare(
    'INSERT INTO course_materials (id, course_id, title, type, content, week_number) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(materialId, courseId, title, type, content, week_number ?? null).run();

  return c.json({
    material: {
      id: materialId,
      course_id: courseId,
      title,
      type,
      content,
      week_number: week_number ?? null,
    },
  }, 201);
});

// List all materials for a course (with optional type filter)
materialRoutes.get('/:courseId/materials', async (c) => {
  const courseId = c.req.param('courseId');
  const typeFilter = c.req.query('type');

  let sql = 'SELECT * FROM course_materials WHERE course_id = ?';
  const params: string[] = [courseId];

  if (typeFilter) {
    sql += ' AND type = ?';
    params.push(typeFilter);
  }

  sql += ' ORDER BY week_number ASC, uploaded_at ASC';

  const materials = await c.env.DB.prepare(sql).bind(...params).all();

  return c.json({ materials: materials.results });
});

// Get a single material
materialRoutes.get('/:courseId/materials/:materialId', async (c) => {
  const courseId = c.req.param('courseId');
  const materialId = c.req.param('materialId');

  const material = await c.env.DB.prepare(
    'SELECT * FROM course_materials WHERE id = ? AND course_id = ?'
  ).bind(materialId, courseId).first();

  if (!material) {
    return c.json({ error: 'Material not found' }, 404);
  }

  return c.json({ material });
});

// Delete a material (professor only)
materialRoutes.delete('/:courseId/materials/:materialId', requireRole('professor'), async (c) => {
  const courseId = c.req.param('courseId');
  const materialId = c.req.param('materialId');

  const material = await c.env.DB.prepare(
    'SELECT id FROM course_materials WHERE id = ? AND course_id = ?'
  ).bind(materialId, courseId).first();

  if (!material) {
    return c.json({ error: 'Material not found' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM course_materials WHERE id = ?').bind(materialId).run();

  return c.json({ deleted: true });
});

// Get announcements for a course (most recent first)
materialRoutes.get('/:courseId/announcements', async (c) => {
  const courseId = c.req.param('courseId');

  const announcements = await c.env.DB.prepare(
    "SELECT * FROM course_materials WHERE course_id = ? AND type = 'announcement' ORDER BY uploaded_at DESC"
  ).bind(courseId).all();

  return c.json({ announcements: announcements.results });
});
