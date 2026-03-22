import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export function ProfessorDashboard() {
  const [courses, setCourses] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [term, setTerm] = useState('Spring 2026');
  const [studentEmails, setStudentEmails] = useState('');
  const [agentRules, setAgentRules] = useState('');
  const [agentPersona, setAgentPersona] = useState('');
  const [error, setError] = useState('');
  const [createdCourse, setCreatedCourse] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.listCourses().then((res) => setCourses(res.courses));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emails = studentEmails
      .split(/[\n,;]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (emails.length === 0) {
      setError('Please provide at least one student email');
      return;
    }

    try {
      const res = await api.createCourse({
        code, title, term,
        student_emails: emails,
        agent_rules: agentRules || undefined,
        agent_persona: agentPersona || undefined,
      });
      setCreatedCourse(res);
      const coursesRes = await api.listCourses();
      setCourses(coursesRes.courses);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>My Courses</h2>
        <button className="btn btn-primary" onClick={() => { setShowCreate(!showCreate); setCreatedCourse(null); }}>
          {showCreate ? 'Cancel' : 'Create Course'}
        </button>
      </div>

      {/* Created course result — shows key + student IDs */}
      {createdCourse && (
        <div className="card" style={{ marginBottom: 20, border: '2px solid #2ecc71' }}>
          <h3 style={{ color: '#2ecc71', marginBottom: 12 }}>Course Created!</h3>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Course Key (share with students for enrollment):</label>
            <code style={{ display: 'block', background: '#f5f5f5', padding: 10, borderRadius: 4, marginTop: 4, fontSize: 16, fontWeight: 700 }}>
              {createdCourse.course.course_key}
            </code>
          </div>

          <div>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Student IDs (send each student their personal ID):</label>
            <div style={{ background: '#f5f5f5', borderRadius: 4, marginTop: 4, maxHeight: 300, overflow: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <th style={{ padding: 8, textAlign: 'left' }}>Email</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Student ID</th>
                  </tr>
                </thead>
                <tbody>
                  {createdCourse.student_roster.map((s: any) => (
                    <tr key={s.student_course_id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 8 }}>{s.email}</td>
                      <td style={{ padding: 8, fontFamily: 'monospace', fontWeight: 600 }}>{s.student_course_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            className="btn btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => { setShowCreate(false); setCreatedCourse(null); }}
          >
            Done
          </button>
        </div>
      )}

      {/* Create course form */}
      {showCreate && !createdCourse && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16 }}>Create New Course</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Course Code</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CS101" required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Intro to Computer Science" required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Term</label>
                <input value={term} onChange={(e) => setTerm(e.target.value)} required />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>
                Student Emails (one per line, or comma/semicolon separated)
              </label>
              <textarea
                value={studentEmails}
                onChange={(e) => setStudentEmails(e.target.value)}
                placeholder={"student1@university.edu\nstudent2@university.edu\nstudent3@university.edu"}
                rows={6}
                style={{ fontFamily: 'monospace', fontSize: 13 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>
                AI Agent Rules (instructions for how the TA agent should behave)
              </label>
              <textarea
                value={agentRules}
                onChange={(e) => setAgentRules(e.target.value)}
                placeholder={"Examples:\n- Always encourage students to attend office hours before escalating\n- For late work, students get one free 3-day extension per semester\n- Never discuss exam answers, even after the exam\n- Always remind students about the tutoring center for coding help"}
                rows={5}
                style={{ fontSize: 13 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>
                Agent Persona (optional — how should the AI present itself?)
              </label>
              <textarea
                value={agentPersona}
                onChange={(e) => setAgentPersona(e.target.value)}
                placeholder={"Example: You are a friendly and patient TA named Alex. You explain things simply and use analogies from everyday life. You're encouraging but honest when a student is on the wrong track."}
                rows={3}
                style={{ fontSize: 13 }}
              />
            </div>

            {error && <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 8 }}>{error}</p>}
            <button type="submit" className="btn btn-primary">Create Course</button>
          </form>
        </div>
      )}

      {/* Course list */}
      {courses.length === 0 && !showCreate ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#666' }}>No courses yet. Create one to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {courses.map((course) => (
            <div key={course.id} className="card">
              <h3 style={{ marginBottom: 4 }}>{course.code}</h3>
              <p style={{ color: '#666', fontSize: 14 }}>{course.title}</p>
              <p style={{ color: '#999', fontSize: 12, marginTop: 4 }}>{course.term}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary" onClick={() => navigate(`/course/${course.id}/setup`)}>Setup</button>
                <button className="btn btn-secondary" onClick={() => navigate(`/course/${course.id}/tickets`)}>Tickets</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
