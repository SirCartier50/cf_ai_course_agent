import { Hono } from 'hono';
import type { Env } from '../env';
import { requireAuth, requireRole } from '../middleware/auth';

export const courseRoutes = new Hono<{ Bindings: Env }>();

courseRoutes.use('*', requireAuth());

// Generate a short random key like "CSE183-A7X9"
function generateCourseKey(code: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${code.toUpperCase()}-${suffix}`;
}

// Generate a student course ID like "STU-A3X9K2"
function generateStudentCourseId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'STU-';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// Create course (professor only)
// Professor provides: code, title, term, student emails, agent rules
courseRoutes.post('/', requireRole('professor'), async (c) => {
  const { code, title, term, student_emails, agent_rules, agent_persona } = await c.req.json();
  const professorId = c.get('userId');

  if (!code || !title || !term) {
    return c.json({ error: 'code, title, and term are required' }, 400);
  }

  if (!student_emails || !Array.isArray(student_emails) || student_emails.length === 0) {
    return c.json({ error: 'student_emails array is required' }, 400);
  }

  const courseId = crypto.randomUUID();
  const courseKey = generateCourseKey(code);

  // Create the course
  await c.env.DB.prepare(
    'INSERT INTO courses (id, code, title, term, professor_id, course_key, agent_rules, agent_persona) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(courseId, code, title, term, professorId, courseKey, agent_rules || null, agent_persona || null).run();

  // Pre-populate student roster with generated IDs
  const studentRoster: { email: string; student_course_id: string }[] = [];
  const stmts = [];

  for (const email of student_emails) {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) continue;

    const studentCourseId = generateStudentCourseId();
    studentRoster.push({ email: trimmedEmail, student_course_id: studentCourseId });

    stmts.push(
      c.env.DB.prepare(
        'INSERT INTO course_students (id, course_id, student_course_id, email, enrolled) VALUES (?, ?, ?, ?, 0)'
      ).bind(crypto.randomUUID(), courseId, studentCourseId, trimmedEmail)
    );
  }

  if (stmts.length > 0) {
    await c.env.DB.batch(stmts);
  }

  return c.json({
    course: { id: courseId, code, title, term, course_key: courseKey },
    student_roster: studentRoster,
  }, 201);
});

// List courses for current user
courseRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const role = c.get('userRole');

  let courses;
  if (role === 'professor') {
    // Don't return course_key in list — it's sensitive
    courses = await c.env.DB.prepare(
      'SELECT id, code, title, term, professor_id, created_at FROM courses WHERE professor_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();
  } else {
    courses = await c.env.DB.prepare(
      `SELECT c.id, c.code, c.title, c.term, c.created_at FROM courses c
       JOIN course_students cs ON c.id = cs.course_id
       WHERE cs.user_id = ? AND cs.enrolled = 1
       ORDER BY c.created_at DESC`
    ).bind(userId).all();
  }

  return c.json({ courses: courses.results });
});

// Get single course
courseRoutes.get('/:courseId', async (c) => {
  const courseId = c.req.param('courseId');
  const course = await c.env.DB.prepare('SELECT * FROM courses WHERE id = ?').bind(courseId).first();

  if (!course) {
    return c.json({ error: 'Course not found' }, 404);
  }

  return c.json({ course });
});

// Get student roster (professor only)
courseRoutes.get('/:courseId/roster', requireRole('professor'), async (c) => {
  const courseId = c.req.param('courseId');

  const students = await c.env.DB.prepare(
    `SELECT cs.student_course_id, cs.email, cs.enrolled, cs.enrolled_at, u.name
     FROM course_students cs
     LEFT JOIN users u ON cs.user_id = u.id
     WHERE cs.course_id = ?
     ORDER BY cs.email`
  ).bind(courseId).all();

  return c.json({ students: students.results });
});

// Reveal course key (professor only, requires password)
courseRoutes.post('/:courseId/reveal-key', requireRole('professor'), async (c) => {
  const courseId = c.req.param('courseId');
  const userId = c.get('userId');
  const { password } = await c.req.json();

  if (!password) {
    return c.json({ error: 'Password is required to reveal the course key' }, 400);
  }

  // Verify course ownership
  const course = await c.env.DB.prepare(
    'SELECT id, course_key FROM courses WHERE id = ? AND professor_id = ?'
  ).bind(courseId, userId).first<{ id: string; course_key: string }>();

  if (!course) {
    return c.json({ error: 'Course not found or not authorized' }, 404);
  }

  // Verify password
  const user = await c.env.DB.prepare(
    'SELECT password_hash FROM users WHERE id = ?'
  ).bind(userId).first<{ password_hash: string }>();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const { verifyPassword } = await import('../middleware/auth');
  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    return c.json({ error: 'Incorrect password' }, 401);
  }

  return c.json({ course_key: course.course_key });
});

// Enroll in course (student only)
// Student provides: course_key + their student_course_id
courseRoutes.post('/enroll', requireRole('student'), async (c) => {
  const { course_key, student_course_id } = await c.req.json();
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');

  if (!course_key || !student_course_id) {
    return c.json({ error: 'course_key and student_course_id are required' }, 400);
  }

  // Find the course by key
  const course = await c.env.DB.prepare(
    'SELECT id, code, title FROM courses WHERE course_key = ?'
  ).bind(course_key).first<{ id: string; code: string; title: string }>();

  if (!course) {
    return c.json({ error: 'Course not found. Check the course key and try again.' }, 404);
  }

  // Find the student entry by student_course_id
  const studentEntry = await c.env.DB.prepare(
    'SELECT id, email, enrolled, user_id FROM course_students WHERE student_course_id = ? AND course_id = ?'
  ).bind(student_course_id, course.id).first<{ id: string; email: string; enrolled: number; user_id: string | null }>();

  if (!studentEntry) {
    return c.json({ error: 'Student ID not found for this course. Contact your professor.' }, 404);
  }

  // Check if already enrolled
  if (studentEntry.enrolled === 1) {
    return c.json({ error: 'This student ID is already enrolled in this course.' }, 409);
  }

  // Enroll: update the record with the user's account and mark enrolled
  await c.env.DB.prepare(
    "UPDATE course_students SET enrolled = 1, user_id = ?, enrolled_at = datetime('now') WHERE id = ?"
  ).bind(userId, studentEntry.id).run();

  // Create student profile for this course
  await c.env.DB.prepare(
    'INSERT INTO student_profiles (id, user_id, course_id) VALUES (?, ?, ?)'
  ).bind(crypto.randomUUID(), userId, course.id).run();

  return c.json({
    enrolled: true,
    course: { id: course.id, code: course.code, title: course.title },
  }, 201);
});
