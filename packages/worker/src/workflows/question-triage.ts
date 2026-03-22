import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import type { Env } from '../env';

interface QuestionTriageParams {
  courseId: string;
  userId: string;
  conversationId: string;
  userMessage: string;
}

export class QuestionTriageWorkflow extends WorkflowEntrypoint<Env, QuestionTriageParams> {
  async run(event: WorkflowEvent<QuestionTriageParams>, step: WorkflowStep) {
    const { courseId, userId, conversationId, userMessage } = event.payload;

    // Step 1: Classify intent
    const intent = await step.do('classify-intent', async () => {
      const response = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any, {
        messages: [
          {
            role: 'system',
            content: `Classify this student question into exactly one category:
- syllabus_query: about course policies, rules, requirements
- grade_scenario: asking about grade calculations or "what do I need" questions
- deadline_info: asking about due dates, deadlines, schedule
- office_hours_query: asking about office hours
- assignment_help: asking for help with homework/assignments
- makeup_request: requesting to make up missed work
- grade_dispute: disputing a grade
- extension_request: asking for a deadline extension
- accommodation: requesting special accommodation
- other: doesn't fit any category

Return ONLY the category name, nothing else.`,
          },
          { role: 'user', content: userMessage },
        ],
      });
      return ((response as any).response || 'other').trim().toLowerCase();
    });

    // Step 2: Determine action based on intent
    const shouldEscalate = ['makeup_request', 'grade_dispute', 'accommodation'].includes(intent);

    if (shouldEscalate) {
      // Step 3a: Create ticket
      await step.do('create-ticket', async () => {
        const ticketId = crypto.randomUUID();
        await this.env.DB.prepare(
          `INSERT INTO tickets (id, course_id, student_id, conversation_id, category, subject, description, status, priority)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'open', 'normal')`
        ).bind(ticketId, courseId, userId, conversationId, intent, `Student ${intent.replace('_', ' ')}`, userMessage).run();
        return { ticket_id: ticketId };
      });
    }

    // Step 4: Log analytics
    await step.do('log-analytics', async () => {
      await this.env.DB.prepare(
        'INSERT INTO analytics_events (id, course_id, event_type, user_id, metadata) VALUES (?, ?, ?, ?, ?)'
      ).bind(
        crypto.randomUUID(),
        courseId,
        shouldEscalate ? 'question_escalated' : 'question_asked',
        userId,
        JSON.stringify({ intent }),
      ).run();
    });

    return { intent, escalated: shouldEscalate };
  }
}
