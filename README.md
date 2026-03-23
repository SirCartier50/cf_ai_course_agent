# cf_ai_course_agent

An AI-powered course assistant platform built on Cloudflare's developer stack. Professors upload syllabi and course materials, an AI agent parses them, and students interact with an agentic AI TA through chat. The AI answers questions using syllabus policies, deadlines, and lecture materials — and escalates anything it can't handle into a ticket system for the professor.

**Live Demo**: https://course-agent.pages.dev

## Features

### For Professors
- **Course creation** with auto-generated course keys and unique student IDs for secure enrollment
- **Syllabus upload & AI parsing** — the AI extracts deadlines, grading weights, policies, and office hours automatically
- **Lecture materials upload** — add lecture notes, slides, resources, and announcements that enrich the AI's knowledge
- **Customizable AI behavior** — set rules and persona for how the TA agent responds to students
- **Ticket dashboard** — review escalated questions, resolve or deny them, and optionally absorb answers into the knowledge base for future students
- **Inappropriate content filtering** — flagged tickets are blurred by default
- **Analytics** — overview of questions asked, auto-resolved rate, open tickets, and at-risk students

### For Students
- **Course enrollment** via course key + personal student ID
- **Course dashboard** with announcements, materials, and upcoming deadlines
- **AI chat** — ask questions about policies, deadlines, grades, and course content
- **Smart escalation** — if the AI can't answer confidently, it creates a ticket for the professor

### AI Agent Capabilities
- 8 tools: syllabus policy lookup, deadline lookup, grading weights, office hours, knowledge base search, grade scenario calculator, course materials search, and ticket creation
- Cites sources and directs students to review original materials
- Never gives direct answers to assignments or exams
- Professor-defined rules are injected into the system prompt

## Architecture

```
cf_ai_course_agent/
├── packages/
│   ├── worker/          # Cloudflare Worker (API + AI agent)
│   └── web/             # React frontend (Vite)
└── package.json         # npm workspaces monorepo
```

## Cloudflare Services Used

| Service | Purpose |
|---------|---------|
| **Workers** | API layer using Hono framework |
| **Workers AI** | LLM inference (Llama 3.3 70B) with tool calling |
| **D1** | SQLite database for users, courses, syllabi, messages, tickets, analytics |
| **KV** | Key-value cache for parsed syllabus data |
| **Workflows** | Multi-step pipelines for syllabus parsing and question triage |
| **Pages** | Static hosting for the React frontend |

## Tech Stack

- **Backend**: TypeScript, Hono, Cloudflare Workers
- **Frontend**: React 19, React Router, Vite
- **Database**: Cloudflare D1 (SQLite)
- **AI Model**: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- **Auth**: JWT with Web Crypto API (HMAC SHA-256), salted password hashing
- **Email**: Resend API for password recovery

## Getting Started

### Prerequisites
- Node.js 18+
- A Cloudflare account with Workers, D1, KV, and AI access
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/cf_ai_course_agent.git
cd cf_ai_course_agent

# Install dependencies
npm install

# Set up the local D1 database
cd packages/worker
npm run db:migrate:local

# Create your .dev.vars file in packages/worker/
echo 'JWT_SECRET=your-secret-here' > .dev.vars
echo 'RESEND_API_KEY=your-resend-key' >> .dev.vars
```

### Local Development

Run in two terminal tabs from the project root:

```bash
# Tab 1 — Backend
npm run dev:worker

# Tab 2 — Frontend
npm run dev:web
```

Open http://localhost:5173

### Deploy to Cloudflare

```bash
# Create D1 database and KV namespace (if not already done)
npx wrangler d1 create course-agent-db
npx wrangler kv namespace create KV

# Update wrangler.toml with your D1 database_id and KV id

# Run migrations on remote D1
cd packages/worker
npx wrangler d1 execute course-agent-db --remote --file=src/db/schema.sql

# Deploy worker
npx wrangler deploy

# Set secrets
npx wrangler secret put JWT_SECRET
npx wrangler secret put RESEND_API_KEY

# Build and deploy frontend
cd ../web
VITE_API_URL=https://cf-ai-course-agent.YOUR_SUBDOMAIN.workers.dev/api npm run build
npx wrangler pages deploy dist --project-name=course-agent
```

## Database Schema

17 tables including:
- `users`, `courses`, `course_students` — auth and enrollment
- `syllabi`, `syllabus_deadlines`, `syllabus_policies`, `syllabus_grading_weights`, `syllabus_office_hours` — parsed syllabus data
- `conversations`, `messages` — chat history
- `tickets` — escalated questions
- `knowledge_entries` — resolved Q&A for reuse
- `course_materials` — lecture notes, slides, announcements
- `student_profiles`, `analytics_events` — usage tracking
- `password_reset_tokens` — account recovery

## How It Works

1. **Professor creates a course** with student emails, AI rules, and persona settings. The system generates a course key and unique student IDs.
2. **Professor uploads the syllabus**. A Cloudflare Workflow parses it with AI, extracting deadlines, policies, grading weights, and office hours into structured database records.
3. **Professor uploads lecture materials** (notes, slides, resources) that the AI can search and cite.
4. **Students enroll** using the course key and their assigned student ID.
5. **Students ask questions** via chat. The AI agent uses tool calling to look up relevant information, then responds with citations.
6. **Questions the AI can't answer** are escalated as tickets. The professor resolves them, and the answer can be absorbed into the knowledge base so the AI handles similar questions automatically next time.
