import { Hono } from 'hono';
import type { Env } from '../env';
import { requireAuth, requireRole } from '../middleware/auth';

export const syllabusRoutes = new Hono<{ Bindings: Env }>();

syllabusRoutes.use('*', requireAuth());

syllabusRoutes.post('/:courseId/syllabus', requireRole('professor'), async (c) => {
  const courseId = c.req.param('courseId');
  let text: string | undefined;

  const contentType = c.req.header('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'A file field is required for file upload' }, 400);
    }

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      text = await file.text();
    } else if (fileName.endsWith('.pdf')) {
      text = await file.text();
    } else {
      return c.json({ error: 'Unsupported file type. Please upload .txt or .md files, or paste PDF text using JSON mode.' }, 400);
    }
  } else {
    const body = await c.req.json();
    text = body.text;
  }

  if (!text) {
    return c.json({ error: 'Syllabus text is required' }, 400);
  }

  const course = await c.env.DB.prepare(
    'SELECT id FROM courses WHERE id = ? AND professor_id = ?'
  ).bind(courseId, c.get('userId')).first();

  if (!course) {
    return c.json({ error: 'Course not found or not authorized' }, 404);
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM syllabi WHERE course_id = ?'
  ).bind(courseId).first<{ id: string }>();

  let syllabusId: string;
  if (existing) {
    syllabusId = existing.id;
    await c.env.DB.prepare(
      'UPDATE syllabi SET raw_text = ?, status = ?, parsed_at = NULL WHERE id = ?'
    ).bind(text, 'pending', syllabusId).run();

    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM syllabus_deadlines WHERE syllabus_id = ?').bind(syllabusId),
      c.env.DB.prepare('DELETE FROM syllabus_policies WHERE syllabus_id = ?').bind(syllabusId),
      c.env.DB.prepare('DELETE FROM syllabus_office_hours WHERE syllabus_id = ?').bind(syllabusId),
      c.env.DB.prepare('DELETE FROM syllabus_grading_weights WHERE syllabus_id = ?').bind(syllabusId),
    ]);
  } else {
    syllabusId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO syllabi (id, course_id, raw_text, status) VALUES (?, ?, ?, ?)'
    ).bind(syllabusId, courseId, text, 'pending').run();
  }

  const instance = await c.env.SYLLABUS_PARSE_WORKFLOW.create({
    params: { syllabusId, courseId, rawText: text },
  });

  return c.json({
    syllabus_id: syllabusId,
    status: 'pending',
    workflow_id: instance.id,
  }, 202);
});

syllabusRoutes.get('/:courseId/syllabus', async (c) => {
  const courseId = c.req.param('courseId');

  const syllabus = await c.env.DB.prepare(
    'SELECT * FROM syllabi WHERE course_id = ?'
  ).bind(courseId).first();

  if (!syllabus) {
    return c.json({ error: 'No syllabus uploaded' }, 404);
  }

  const [deadlines, policies, officeHours, gradingWeights] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM syllabus_deadlines WHERE syllabus_id = ? ORDER BY due_date').bind(syllabus.id).all(),
    c.env.DB.prepare('SELECT * FROM syllabus_policies WHERE syllabus_id = ?').bind(syllabus.id).all(),
    c.env.DB.prepare('SELECT * FROM syllabus_office_hours WHERE syllabus_id = ?').bind(syllabus.id).all(),
    c.env.DB.prepare('SELECT * FROM syllabus_grading_weights WHERE syllabus_id = ?').bind(syllabus.id).all(),
  ]);

  return c.json({
    syllabus,
    deadlines: deadlines.results,
    policies: policies.results,
    office_hours: officeHours.results,
    grading_weights: gradingWeights.results,
  });
});

syllabusRoutes.get('/:courseId/syllabus/status', async (c) => {
  const courseId = c.req.param('courseId');
  const syllabus = await c.env.DB.prepare(
    'SELECT id, status, parsed_at FROM syllabi WHERE course_id = ?'
  ).bind(courseId).first();

  if (!syllabus) {
    return c.json({ error: 'No syllabus uploaded' }, 404);
  }

  return c.json({ status: syllabus.status, parsed_at: syllabus.parsed_at });
});

syllabusRoutes.get('/:courseId/deadlines', async (c) => {
  const courseId = c.req.param('courseId');
  const deadlines = await c.env.DB.prepare(
    `SELECT d.* FROM syllabus_deadlines d
     JOIN syllabi s ON d.syllabus_id = s.id
     WHERE s.course_id = ? AND d.due_date >= datetime('now')
     ORDER BY d.due_date ASC`
  ).bind(courseId).all();

  return c.json({ deadlines: deadlines.results });
});
