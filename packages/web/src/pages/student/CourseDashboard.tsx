import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export function CourseDashboard() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;

    setLoading(true);

    Promise.all([
      api.getCourse(courseId).then((res) => setCourse(res.course)).catch(() => {}),
      api.getAnnouncements(courseId).then((res) => setAnnouncements(res.announcements)).catch(() => {}),
      api.getMaterials(courseId).then((res) => setMaterials(res.materials)).catch(() => {}),
      api.getDeadlines(courseId).then((res) => setDeadlines(res.deadlines)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: 40 }}>
        <p>Loading course...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          className="btn btn-secondary"
          style={{ fontSize: 13, padding: '4px 10px' }}
          onClick={() => navigate('/')}
        >
          &larr; Back
        </button>
        <div>
          <h2 style={{ marginBottom: 2 }}>{course?.code} - {course?.title}</h2>
          <p style={{ color: '#999', fontSize: 13 }}>{course?.term}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Need help with this course?</h3>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>
          Ask questions about deadlines, policies, grades, and more.
        </p>
        <button
          className="btn btn-primary"
          style={{ fontSize: 16, padding: '12px 32px' }}
          onClick={() => navigate(`/course/${courseId}/chat`)}
        >
          Ask the AI TA
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Announcements</h3>
        {announcements.length === 0 ? (
          <p style={{ color: '#999', fontSize: 14 }}>No announcements yet.</p>
        ) : (
          announcements.map((a: any) => (
            <div key={a.id} style={{ marginBottom: 12, padding: 12, background: '#f9f9f9', borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</span>
                <span style={{ fontSize: 11, color: '#999' }}>
                  {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#444' }}>{a.content}</p>
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Course Materials</h3>
        {materials.length === 0 ? (
          <p style={{ color: '#999', fontSize: 14 }}>No course materials available yet.</p>
        ) : (
          materials.map((m: any) => (
            <div key={m.id} style={{ marginBottom: 8, padding: 10, background: '#f9f9f9', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: '#f6821f', fontWeight: 500, textTransform: 'uppercase' }}>{m.type}</span>
                {m.week_number && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: '#999' }}>Week {m.week_number}</span>
                )}
              </div>
              <span style={{ fontSize: 11, color: '#999' }}>
                {m.created_at ? new Date(m.created_at).toLocaleDateString() : ''}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Upcoming Deadlines</h3>
        {deadlines.length === 0 ? (
          <p style={{ color: '#999', fontSize: 14 }}>No upcoming deadlines.</p>
        ) : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>Title</th>
                <th style={{ padding: 8 }}>Type</th>
                <th style={{ padding: 8 }}>Due Date</th>
                <th style={{ padding: 8 }}>Weight</th>
              </tr>
            </thead>
            <tbody>
              {deadlines.map((d: any) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: 8 }}>{d.title}</td>
                  <td style={{ padding: 8 }}>{d.type}</td>
                  <td style={{ padding: 8 }}>{d.due_date}</td>
                  <td style={{ padding: 8 }}>{d.weight ? `${(d.weight * 100).toFixed(0)}%` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
