import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env';
import { authRoutes } from './routes/auth';
import { courseRoutes } from './routes/courses';
import { syllabusRoutes } from './routes/syllabus';
import { chatRoutes } from './routes/chat';
import { ticketRoutes } from './routes/tickets';
import { analyticsRoutes } from './routes/analytics';
import { materialRoutes } from './routes/materials';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/', (c) => c.json({ status: 'ok', service: 'cf-ai-course-agent' }));

app.route('/api/auth', authRoutes);
app.route('/api/courses', courseRoutes);
app.route('/api/courses', syllabusRoutes);
app.route('/api/courses', chatRoutes);
app.route('/api/courses', ticketRoutes);
app.route('/api/courses', analyticsRoutes);
app.route('/api/courses', materialRoutes);

export { SyllabusParseWorkflow } from './workflows/syllabus-parse';
export { QuestionTriageWorkflow } from './workflows/question-triage';

export default app;
