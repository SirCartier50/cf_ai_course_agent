import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export function ProfessorCourseDashboard() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementPosting, setAnnouncementPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    Promise.all([
      api.getCourse(courseId).then((res) => setCourse(res.course)).catch(() => {}),
      api.listTickets(courseId, 'open').then((res) => setTickets(res.tickets)).catch(() => {}),
      api.getMaterials(courseId).then((res) => setMaterials(res.materials)).catch(() => {}),
      api.getRoster(courseId).then((res) => setRoster(res.students)).catch(() => {}),
      api.getOverview(courseId).then((res) => setOverview(res)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return <div className="container" style={{ textAlign: 'center', padding: 40 }}><p>Loading course...</p></div>;
  }

  const enrolledCount = roster.filter((s: any) => s.enrolled).length;

  const handlePostAnnouncement = async () => {
    if (!courseId || !announcementTitle.trim() || !announcementContent.trim()) return;
    setAnnouncementPosting(true);
    try {
      await api.uploadMaterial(courseId, {
        title: announcementTitle,
        type: 'announcement',
        content: announcementContent,
      });
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setShowAnnouncement(false);
      const res = await api.getMaterials(courseId);
      setMaterials(res.materials);
    } catch {}
    setAnnouncementPosting(false);
  };

  const handleQuickUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = '';
    navigate(`/course/${courseId}/setup`);
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-secondary" style={{ fontSize: 13, padding: '4px 10px' }} onClick={() => navigate('/')}>
          &larr; Back
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ marginBottom: 2 }}>{course?.code} - {course?.title}</h2>
          <p style={{ color: '#999', fontSize: 13 }}>{course?.term}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowAnnouncement(true)}>
            Post Announcement
          </button>
          <input ref={fileInputRef} type="file" accept=".txt,.md" style={{ display: 'none' }} onChange={handleQuickUpload} />
          <button className="btn btn-secondary" onClick={() => navigate(`/course/${courseId}/setup`)}>
            Upload Material
          </button>
          <button className="btn btn-secondary" onClick={() => navigate(`/course/${courseId}/setup`)}>
            Settings
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f6821f' }}>{enrolledCount}/{roster.length}</div>
          <div style={{ fontSize: 12, color: '#666' }}>Students Enrolled</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#e74c3c' }}>{tickets.length}</div>
          <div style={{ fontSize: 12, color: '#666' }}>Open Tickets</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#3498db' }}>{materials.length}</div>
          <div style={{ fontSize: 12, color: '#666' }}>Materials Uploaded</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2ecc71' }}>{overview?.total_questions || 0}</div>
          <div style={{ fontSize: 12, color: '#666' }}>Questions Asked</div>
        </div>
      </div>

      <div
        className="card"
        style={{ cursor: 'pointer', transition: 'box-shadow 0.2s', marginBottom: 20 }}
        onClick={() => navigate(`/course/${courseId}/tickets`)}
      >
        <h3 style={{ marginBottom: 4 }}>Tickets</h3>
        <p style={{ color: '#666', fontSize: 13 }}>
          {tickets.length > 0 ? `${tickets.length} open ticket${tickets.length > 1 ? 's' : ''} waiting for review.` : 'No open tickets.'}
        </p>
      </div>

      {tickets.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3>Recent Open Tickets</h3>
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => navigate(`/course/${courseId}/tickets`)}>
              View All
            </button>
          </div>
          {tickets.slice(0, 5).map((t: any) => (
            <div key={t.id} style={{ padding: 10, background: '#f9f9f9', borderRadius: 6, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t.subject}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: '#999' }}>{t.category}</span>
              </div>
              <span style={{ background: '#e74c3c', color: 'white', padding: '1px 6px', borderRadius: 3, fontSize: 11 }}>
                {t.priority}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 8 }}>Student Roster</h3>
        <p style={{ fontSize: 13, color: '#666' }}>
          {enrolledCount} of {roster.length} students enrolled.
          {roster.length - enrolledCount > 0 && (
            <span style={{ color: '#e74c3c' }}> {roster.length - enrolledCount} pending.</span>
          )}
        </p>
      </div>

      {materials.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Course Materials</h3>
          {materials.slice(0, 5).map((m: any) => (
            <div key={m.id} style={{ padding: 8, background: '#f9f9f9', borderRadius: 6, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{m.title}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: '#f6821f', fontWeight: 500, textTransform: 'uppercase' }}>{m.type}</span>
              </div>
              <span style={{ fontSize: 11, color: '#999' }}>
                {m.uploaded_at ? new Date(m.uploaded_at).toLocaleDateString() : ''}
              </span>
            </div>
          ))}
          {materials.length > 5 && (
            <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>+{materials.length - 5} more</p>
          )}
        </div>
      )}

      {showAnnouncement && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowAnnouncement(false)}>
          <div className="card" style={{ width: 500, padding: 28 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>Post Announcement</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Title</label>
              <input
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                placeholder="e.g. Midterm Exam Reminders"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Content</label>
              <textarea
                value={announcementContent}
                onChange={(e) => setAnnouncementContent(e.target.value)}
                placeholder="Write your announcement..."
                rows={6}
                style={{ fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={announcementPosting || !announcementTitle.trim() || !announcementContent.trim()}
                onClick={handlePostAnnouncement}
              >
                {announcementPosting ? 'Posting...' : 'Post'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowAnnouncement(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
