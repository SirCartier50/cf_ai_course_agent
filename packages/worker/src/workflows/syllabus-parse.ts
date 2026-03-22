import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import type { Env } from '../env';

interface SyllabusParseParams {
  syllabusId: string;
  courseId: string;
  rawText: string;
}

export class SyllabusParseWorkflow extends WorkflowEntrypoint<Env, SyllabusParseParams> {
  async run(event: WorkflowEvent<SyllabusParseParams>, step: WorkflowStep) {
    const { syllabusId, courseId, rawText } = event.payload;

    // Step 1: Update status to parsing
    await step.do('update-status-parsing', async () => {
      await this.env.DB.prepare(
        "UPDATE syllabi SET status = 'parsing' WHERE id = ?"
      ).bind(syllabusId).run();
    });

    // Step 2: Extract deadlines
    const deadlines = await step.do('extract-deadlines', async () => {
      const response = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any, {
        messages: [
          {
            role: 'system',
            content: `You are a syllabus parser. Extract ALL deadlines, assignments, exams, quizzes, and projects with their due dates from the syllabus text.
Return ONLY a JSON array with this format:
[{"title": "Assignment 1", "type": "assignment|exam|quiz|project|other", "due_date": "2026-MM-DD", "weight": 0.15, "description": "brief description"}]
If no weight is mentioned, set it to null. Use ISO 8601 dates. If only relative dates are given (e.g., "Week 5"), estimate based on a standard semester starting January 2026.
Return ONLY valid JSON, no other text.`,
          },
          { role: 'user', content: rawText },
        ],
      });
      try {
        const text = (response as any).response || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch {
        return [];
      }
    });

    // Step 3: Extract grading weights
    const gradingWeights = await step.do('extract-grading-weights', async () => {
      const response = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any, {
        messages: [
          {
            role: 'system',
            content: `Extract the grading breakdown from this syllabus.
Return ONLY a JSON array: [{"component": "Midterm Exam", "weight": 0.25, "drop_lowest": 0}]
Weights should be decimals that sum to 1.0. drop_lowest is how many lowest scores are dropped (0 if not mentioned).
Return ONLY valid JSON, no other text.`,
          },
          { role: 'user', content: rawText },
        ],
      });
      try {
        const text = (response as any).response || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch {
        return [];
      }
    });

    // Step 4: Extract policies
    const policies = await step.do('extract-policies', async () => {
      const response = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any, {
        messages: [
          {
            role: 'system',
            content: `Extract all policies from this syllabus. Look for: late work, attendance, academic integrity, makeup exams, grading scale, extra credit, and any other policies.
Return ONLY a JSON array:
[{"category": "late_work|attendance|academic_integrity|makeup_exam|grading_scale|extra_credit|other", "policy_text": "full policy text", "conditions": {"key": "value"}}]
For conditions, extract machine-readable rules like {"late_penalty_per_day": 10, "max_late_days": 3}.
Return ONLY valid JSON, no other text.`,
          },
          { role: 'user', content: rawText },
        ],
      });
      try {
        const text = (response as any).response || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch {
        return [];
      }
    });

    // Step 5: Extract office hours
    const officeHours = await step.do('extract-office-hours', async () => {
      const response = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any, {
        messages: [
          {
            role: 'system',
            content: `Extract all office hours from this syllabus.
Return ONLY a JSON array:
[{"instructor": "Dr. Smith", "day_of_week": "Monday", "start_time": "14:00", "end_time": "16:00", "location": "Room 301", "is_virtual": false}]
Use 24-hour time format. Return ONLY valid JSON, no other text.`,
          },
          { role: 'user', content: rawText },
        ],
      });
      try {
        const text = (response as any).response || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch {
        return [];
      }
    });

    // Step 6: Persist all parsed data to D1
    await step.do('persist-to-d1', async () => {
      const stmts = [];

      for (const d of deadlines) {
        stmts.push(
          this.env.DB.prepare(
            'INSERT INTO syllabus_deadlines (id, syllabus_id, title, type, due_date, weight, description) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(crypto.randomUUID(), syllabusId, d.title, d.type || 'other', d.due_date, d.weight, d.description)
        );
      }

      for (const w of gradingWeights) {
        stmts.push(
          this.env.DB.prepare(
            'INSERT INTO syllabus_grading_weights (id, syllabus_id, component, weight, drop_lowest) VALUES (?, ?, ?, ?, ?)'
          ).bind(crypto.randomUUID(), syllabusId, w.component, w.weight, w.drop_lowest || 0)
        );
      }

      for (const p of policies) {
        stmts.push(
          this.env.DB.prepare(
            'INSERT INTO syllabus_policies (id, syllabus_id, category, policy_text, conditions) VALUES (?, ?, ?, ?, ?)'
          ).bind(crypto.randomUUID(), syllabusId, p.category, p.policy_text, p.conditions ? JSON.stringify(p.conditions) : null)
        );
      }

      for (const o of officeHours) {
        stmts.push(
          this.env.DB.prepare(
            'INSERT INTO syllabus_office_hours (id, syllabus_id, instructor, day_of_week, start_time, end_time, location, is_virtual) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(crypto.randomUUID(), syllabusId, o.instructor, o.day_of_week, o.start_time, o.end_time, o.location, o.is_virtual ? 1 : 0)
        );
      }

      if (stmts.length > 0) {
        await this.env.DB.batch(stmts);
      }
    });

    // Step 7: Cache key data in KV
    await step.do('populate-kv-cache', async () => {
      await Promise.all([
        this.env.KV.put(`course:${courseId}:deadlines`, JSON.stringify(deadlines)),
        this.env.KV.put(`course:${courseId}:weights`, JSON.stringify(gradingWeights)),
        this.env.KV.put(`course:${courseId}:policies`, JSON.stringify(policies)),
        this.env.KV.put(`course:${courseId}:office_hours`, JSON.stringify(officeHours)),
      ]);
    });

    // Step 8: Generate initial knowledge base entries from syllabus
    await step.do('seed-knowledge-base', async () => {
      const entries = [];
      for (const p of policies) {
        let question = '';
        switch (p.category) {
          case 'late_work': question = 'What is the late work policy?'; break;
          case 'attendance': question = 'What is the attendance policy?'; break;
          case 'academic_integrity': question = 'What is the academic integrity policy?'; break;
          case 'makeup_exam': question = 'Can I make up a missed exam?'; break;
          case 'grading_scale': question = 'What is the grading scale?'; break;
          case 'extra_credit': question = 'Is there extra credit?'; break;
          default: continue;
        }
        entries.push(
          this.env.DB.prepare(
            'INSERT INTO knowledge_entries (id, course_id, question, answer, source, approved) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(crypto.randomUUID(), courseId, question, p.policy_text, 'syllabus', 1)
        );
      }
      if (entries.length > 0) {
        await this.env.DB.batch(entries);
      }
    });

    // Step 9: Update status to parsed
    await step.do('finalize', async () => {
      await this.env.DB.prepare(
        "UPDATE syllabi SET status = 'parsed', parsed_at = datetime('now') WHERE id = ?"
      ).bind(syllabusId).run();

      await this.env.DB.prepare(
        'INSERT INTO analytics_events (id, course_id, event_type, metadata) VALUES (?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), courseId, 'syllabus_parsed', JSON.stringify({
        deadlines: deadlines.length,
        policies: policies.length,
        weights: gradingWeights.length,
        office_hours: officeHours.length,
      })).run();
    });

    return {
      deadlines: deadlines.length,
      policies: policies.length,
      gradingWeights: gradingWeights.length,
      officeHours: officeHours.length,
    };
  }
}
