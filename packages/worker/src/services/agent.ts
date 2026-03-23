import type { Env } from '../env';

interface AgentInput {
  env: Env;
  courseId: string;
  userId: string;
  conversationId: string;
  userMessage: string;
}

interface AgentResponse {
  content: string;
  toolCalls?: { name: string; arguments: Record<string, unknown>; result: unknown }[];
  metadata?: { confidence?: number; sources?: string[]; escalated?: boolean; ticket_id?: string };
}

const BASE_SYSTEM_PROMPT = `You are an AI Teaching Assistant for a university course. You help students with course-related questions by using the syllabus and course materials as your source of truth.

STRICT RULES:
1. NEVER provide direct answers to assignments, homework, quizzes, or exams. Instead:
   - Ask what the student has tried so far
   - Point them to relevant concepts from course materials
   - Give hints that guide their thinking
   - Suggest office hours if they need more help

2. NEVER make up policies or information. Only cite what exists in the syllabus and knowledge base.

3. NEVER make grade-related promises. Always escalate grade disputes.

4. When you're unsure, say "I don't have enough information to answer that confidently. Let me forward this to your professor." — never guess.

5. For makeup requests, extension requests, and accommodations — provide the relevant policy, then escalate to the professor via a ticket.

6. Be friendly, concise, and helpful. You're a knowledgeable TA, not a robot.

7. When answering questions about course content, ALWAYS cite the source material. Say things like "According to Lecture 3 notes..." or "This is covered in the Week 5 slides." Direct students to review the original materials rather than just giving them the information. You are a study guide, not a replacement for attending class.

You have access to the following tools to look up information. Use them before answering.`;

function buildSystemPrompt(agentRules: string | null, agentPersona: string | null): string {
  let prompt = BASE_SYSTEM_PROMPT;

  if (agentPersona) {
    prompt += `\n\nPERSONA: ${agentPersona}`;
  }

  if (agentRules) {
    prompt += `\n\nADDITIONAL RULES SET BY THE PROFESSOR:\n${agentRules}`;
  }

  return prompt;
}

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'lookup_syllabus_policy',
      description: 'Look up a specific policy from the course syllabus.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['late_work', 'attendance', 'academic_integrity', 'makeup_exam', 'grading_scale', 'extra_credit', 'other'],
          },
        },
        required: ['category'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'lookup_deadlines',
      description: 'Look up upcoming deadlines for the course.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['assignment', 'exam', 'quiz', 'project', 'all'] },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'lookup_grading_weights',
      description: 'Look up the grading weight breakdown for the course.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'lookup_office_hours',
      description: 'Look up office hours for the course.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_knowledge_base',
      description: 'Search previously answered questions for this course.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_grade_scenario',
      description: 'Calculate what grade a student needs on remaining assessments to achieve a target grade.',
      parameters: {
        type: 'object',
        properties: {
          current_grades: {
            type: 'string',
            description: 'JSON string of current grades, e.g. [{"component":"Midterm","score":85}]',
          },
          target_grade: { type: 'string', enum: ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F'] },
        },
        required: ['current_grades', 'target_grade'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_course_materials',
      description: 'Search lecture notes, slides, and course materials for relevant information. Use this when students ask about concepts covered in lectures.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
          type: { type: 'string', enum: ['lecture_notes', 'slides', 'resource', 'all'] },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_ticket',
      description: 'Escalate to the professor by creating a ticket. Use when the question cannot be confidently answered or requires human judgment.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['makeup_request', 'grade_dispute', 'extension_request', 'clarification', 'accommodation', 'other'],
          },
          subject: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['category', 'subject', 'description'],
      },
    },
  },
];

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  env: Env,
  courseId: string,
  userId: string,
  conversationId: string
): Promise<unknown> {
  switch (toolName) {
    case 'lookup_syllabus_policy': {
      const syllabus = await env.DB.prepare('SELECT id, raw_text FROM syllabi WHERE course_id = ?').bind(courseId).first<{ id: string; raw_text: string }>();
      if (!syllabus) return { error: 'No syllabus uploaded for this course' };
      const policies = await env.DB.prepare(
        'SELECT category, policy_text, conditions FROM syllabus_policies WHERE syllabus_id = ? AND category = ?'
      ).bind(syllabus.id, args.category).all();
      if (policies.results.length > 0) return policies.results;
      if (syllabus.raw_text) {
        return { raw_syllabus: syllabus.raw_text, note: 'Structured policies not extracted yet. Use the raw syllabus text to find the relevant policy.' };
      }
      return { message: 'No policy found for this category' };
    }

    case 'lookup_deadlines': {
      const syllabus = await env.DB.prepare('SELECT id, raw_text FROM syllabi WHERE course_id = ?').bind(courseId).first<{ id: string; raw_text: string }>();
      if (!syllabus) return { error: 'No syllabus uploaded' };
      let query = 'SELECT title, type, due_date, weight, description FROM syllabus_deadlines WHERE syllabus_id = ?';
      const params: string[] = [syllabus.id];
      if (args.type && args.type !== 'all') {
        query += ' AND type = ?';
        params.push(args.type as string);
      }
      query += " AND due_date >= datetime('now') ORDER BY due_date ASC";
      const deadlines = await env.DB.prepare(query).bind(...params).all();
      if (deadlines.results.length > 0) return deadlines.results;
      if (syllabus.raw_text) {
        return { raw_syllabus: syllabus.raw_text, note: 'Structured deadlines not extracted yet. Use the raw syllabus text to find deadlines.' };
      }
      return [];
    }

    case 'lookup_grading_weights': {
      const syllabus = await env.DB.prepare('SELECT id, raw_text FROM syllabi WHERE course_id = ?').bind(courseId).first<{ id: string; raw_text: string }>();
      if (!syllabus) return { error: 'No syllabus uploaded' };
      const weights = await env.DB.prepare(
        'SELECT component, weight, drop_lowest FROM syllabus_grading_weights WHERE syllabus_id = ?'
      ).bind(syllabus.id).all();
      if (weights.results.length > 0) return weights.results;
      if (syllabus.raw_text) {
        return { raw_syllabus: syllabus.raw_text, note: 'Structured grading weights not extracted yet. Use the raw syllabus text to find grading breakdown.' };
      }
      return [];
    }

    case 'lookup_office_hours': {
      const syllabus = await env.DB.prepare('SELECT id, raw_text FROM syllabi WHERE course_id = ?').bind(courseId).first<{ id: string; raw_text: string }>();
      if (!syllabus) return { error: 'No syllabus uploaded' };
      const hours = await env.DB.prepare(
        'SELECT instructor, day_of_week, start_time, end_time, location, is_virtual FROM syllabus_office_hours WHERE syllabus_id = ?'
      ).bind(syllabus.id).all();
      if (hours.results.length > 0) return hours.results;
      if (syllabus.raw_text) {
        return { raw_syllabus: syllabus.raw_text, note: 'Structured office hours not extracted yet. Use the raw syllabus text to find office hours.' };
      }
      return [];
    }

    case 'search_knowledge_base': {
      const query = args.query as string;
      const entries = await env.DB.prepare(
        "SELECT question, answer, source FROM knowledge_entries WHERE course_id = ? AND approved = 1 AND question LIKE ? LIMIT 5"
      ).bind(courseId, `%${query}%`).all();
      return entries.results.length > 0 ? entries.results : { message: 'No matching entries found' };
    }

    case 'calculate_grade_scenario': {
      const syllabus = await env.DB.prepare('SELECT id, raw_text FROM syllabi WHERE course_id = ?').bind(courseId).first<{ id: string; raw_text: string }>();
      if (!syllabus) return { error: 'No syllabus uploaded' };
      const weights = await env.DB.prepare(
        'SELECT component, weight FROM syllabus_grading_weights WHERE syllabus_id = ?'
      ).bind(syllabus.id).all();

      const currentGrades = JSON.parse(args.current_grades as string);
      const gradeScale: Record<string, number> = {
        'A': 93, 'A-': 90, 'B+': 87, 'B': 83, 'B-': 80,
        'C+': 77, 'C': 73, 'D': 60, 'F': 0,
      };
      const targetScore = gradeScale[args.target_grade as string] || 0;

      if (weights.results.length > 0) {
        return {
          grading_weights: weights.results,
          current_grades: currentGrades,
          target_minimum_score: targetScore,
          note: 'Use the weights and current grades to calculate what the student needs.',
        };
      }
      return {
        raw_syllabus: syllabus.raw_text || '',
        current_grades: currentGrades,
        target_minimum_score: targetScore,
        note: 'Structured grading weights not extracted. Use the raw syllabus text to find grading breakdown and calculate.',
      };
    }

    case 'search_course_materials': {
      const query = args.query as string;
      const type = args.type as string;
      let sql = "SELECT title, type, content, week_number FROM course_materials WHERE course_id = ? AND content LIKE ?";
      const params: any[] = [courseId, `%${query}%`];
      if (type && type !== 'all') {
        sql += " AND type = ?";
        params.push(type);
      }
      sql += " LIMIT 3";
      const materials = await env.DB.prepare(sql).bind(...params).all();
      if (materials.results.length > 0) {
        return materials.results.map((m: any) => ({
          title: m.title,
          type: m.type,
          week: m.week_number,
          excerpt: m.content.substring(0, 500) + (m.content.length > 500 ? '...' : ''),
        }));
      }
      return { message: 'No matching course materials found' };
    }

    case 'create_ticket': {
      const ticketId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO tickets (id, course_id, student_id, conversation_id, category, subject, description, status, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'open', 'normal')`
      ).bind(
        ticketId, courseId, userId, conversationId,
        args.category, args.subject, args.description
      ).run();

      await env.DB.prepare(
        'INSERT INTO analytics_events (id, course_id, event_type, user_id, metadata) VALUES (?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), courseId, 'ticket_created', userId, JSON.stringify({ ticket_id: ticketId })).run();

      return { ticket_id: ticketId, status: 'created', message: 'Ticket created and sent to the teaching staff.' };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

async function aiCall(env: Env, model: string, params: any): Promise<any> {
  try {
    const result = await env.AI.run(model as any, params);
    return result;
  } catch (err: any) {
    console.error('AI call failed:', err?.message || err);
    throw new Error(`AI call failed: ${err?.message || 'Unknown error'}`);
  }
}

export async function runAgent(input: AgentInput): Promise<AgentResponse> {
  const { env, courseId, userId, conversationId, userMessage } = input;

  const syllabus = await env.DB.prepare(
    'SELECT id, status FROM syllabi WHERE course_id = ?'
  ).bind(courseId).first<{ id: string; status: string }>();

  const course = await env.DB.prepare(
    'SELECT agent_rules, agent_persona FROM courses WHERE id = ?'
  ).bind(courseId).first<{ agent_rules: string | null; agent_persona: string | null }>();

  let systemPrompt = buildSystemPrompt(course?.agent_rules || null, course?.agent_persona || null);

  if (!syllabus || syllabus.status !== 'parsed') {
    systemPrompt += '\n\nIMPORTANT: No syllabus has been uploaded for this course yet. If the student asks about policies, deadlines, grading, or office hours, let them know that the syllabus has not been uploaded yet and suggest they contact their professor directly. You can still help with general questions.';
  }

  const history = await env.DB.prepare(
    'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 10'
  ).bind(conversationId).all<{ role: string; content: string }>();

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...(history.results || []).reverse().map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const response = await aiCall(env, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages,
    tools: TOOLS,
  });

  const toolCalls: { name: string; arguments: Record<string, unknown>; result: unknown }[] = [];
  let finalContent = '';
  let escalated = false;
  let ticketId: string | undefined;

  const aiResponse = response as any;

  if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
    for (const toolCall of aiResponse.tool_calls) {
      const fnName = toolCall.function?.name || toolCall.name;
      const fnArgs = toolCall.function?.arguments
        ? (typeof toolCall.function.arguments === 'string' ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments)
        : (toolCall.arguments || {});

      const result = await executeTool(
        fnName,
        fnArgs,
        env, courseId, userId, conversationId
      );

      toolCalls.push({
        name: fnName,
        arguments: fnArgs,
        result,
      });

      if (fnName === 'create_ticket') {
        escalated = true;
        ticketId = (result as any).ticket_id;
      }
    }

    const normalizedToolCalls = aiResponse.tool_calls.map((tc: any, i: number) => ({
      id: tc.id || `call_${i}`,
      type: 'function',
      function: {
        name: tc.function?.name || tc.name,
        arguments: tc.function?.arguments
          ? (typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments))
          : JSON.stringify(tc.arguments || {}),
      },
    }));

    const toolResultMessages = normalizedToolCalls.map((tc: any, i: number) => ({
      role: 'tool' as const,
      tool_call_id: tc.id,
      content: JSON.stringify(toolCalls[i].result),
    }));

    const followUp = await aiCall(env, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        ...messages,
        { role: 'assistant', content: '', tool_calls: normalizedToolCalls },
        ...toolResultMessages,
      ],
    });

    finalContent = (followUp as any).response || (followUp as any).content || '';
  } else {
    finalContent = aiResponse.response || aiResponse.content || '';
  }

  return {
    content: finalContent,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    metadata: {
      escalated,
      ticket_id: ticketId,
      sources: toolCalls.map((tc) => tc.name),
    },
  };
}
