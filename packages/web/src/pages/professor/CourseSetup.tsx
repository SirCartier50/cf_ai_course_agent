import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';

export function CourseSetup() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<any>(null);
  const [syllabusText, setSyllabusText] = useState('');
  const [syllabusStatus, setSyllabusStatus] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Reveal key state
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyPassword, setKeyPassword] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState('');
  const [keyLoading, setKeyLoading] = useState(false);
  const keyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Roster state
  const [roster, setRoster] = useState<any[]>([]);
  const [showRoster, setShowRoster] = useState(false);

  // Materials state
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialType, setMaterialType] = useState('Lecture Notes');
  const [materialWeek, setMaterialWeek] = useState('');
  const [materialContent, setMaterialContent] = useState('');
  const [materialUploading, setMaterialUploading] = useState(false);
  const [materialError, setMaterialError] = useState('');
  const [materials, setMaterials] = useState<any[]>([]);

  const loadMaterials = async () => {
    if (!courseId) return;
    try {
      const res = await api.getMaterials(courseId);
      setMaterials(res.materials);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!courseId) return;
    api.getCourse(courseId).then((res) => setCourse(res.course));
    api.getSyllabusStatus(courseId)
      .then((res) => {
        setSyllabusStatus(res.status);
        if (res.status === 'parsed') {
          api.getSyllabus(courseId).then(setParsedData);
        }
      })
      .catch(() => setSyllabusStatus(null));
    loadMaterials();
  }, [courseId]);

  // Poll for parsing status
  useEffect(() => {
    if (syllabusStatus !== 'parsing' || !courseId) return;
    const interval = setInterval(async () => {
      const res = await api.getSyllabusStatus(courseId);
      setSyllabusStatus(res.status);
      if (res.status === 'parsed') {
        const data = await api.getSyllabus(courseId);
        setParsedData(data);
        clearInterval(interval);
      } else if (res.status === 'error') {
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [syllabusStatus, courseId]);

  // Clean up key reveal timer
  useEffect(() => {
    return () => {
      if (keyTimerRef.current) clearTimeout(keyTimerRef.current);
    };
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !syllabusText.trim()) return;
    setUploading(true);
    setError('');
    try {
      await api.uploadSyllabus(courseId, syllabusText);
      setSyllabusStatus('parsing');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRevealKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !keyPassword) return;
    setKeyError('');
    setKeyLoading(true);
    try {
      const res = await api.revealCourseKey(courseId, keyPassword);
      setRevealedKey(res.course_key);
      setKeyPassword('');
      // Auto-hide after 30 seconds
      keyTimerRef.current = setTimeout(() => {
        setRevealedKey(null);
        setShowKeyModal(false);
      }, 30000);
    } catch (err: any) {
      setKeyError(err.message);
    } finally {
      setKeyLoading(false);
    }
  };

  const handleLoadRoster = async () => {
    if (!courseId) return;
    const res = await api.getRoster(courseId);
    setRoster(res.students);
    setShowRoster(true);
  };

  return (
    <div className="container">
      <h2 style={{ marginBottom: 20 }}>{course?.code} - Course Setup</h2>

      {/* Course Key Section */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ marginBottom: 4 }}>Course Key</h3>
            <p style={{ fontSize: 13, color: '#666' }}>Students need this key to enroll. Keep it secure.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowKeyModal(true)}>
            Reveal Key
          </button>
        </div>
      </div>

      {/* Student Roster */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showRoster ? 12 : 0 }}>
          <div>
            <h3 style={{ marginBottom: 4 }}>Student Roster</h3>
            <p style={{ fontSize: 13, color: '#666' }}>View student IDs and enrollment status.</p>
          </div>
          <button className="btn btn-secondary" onClick={handleLoadRoster}>
            {showRoster ? 'Refresh' : 'View Roster'}
          </button>
        </div>

        {showRoster && (
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
                  <th style={{ padding: 8 }}>Email</th>
                  <th style={{ padding: 8 }}>Student ID</th>
                  <th style={{ padding: 8 }}>Name</th>
                  <th style={{ padding: 8 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s: any) => (
                  <tr key={s.student_course_id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: 8 }}>{s.email}</td>
                    <td style={{ padding: 8, fontFamily: 'monospace', fontWeight: 600 }}>{s.student_course_id}</td>
                    <td style={{ padding: 8 }}>{s.name || '—'}</td>
                    <td style={{ padding: 8 }}>
                      <span style={{
                        background: s.enrolled ? '#2ecc71' : '#e74c3c',
                        color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 11
                      }}>
                        {s.enrolled ? 'Enrolled' : 'Not enrolled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Syllabus Upload */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Syllabus</h3>

        {syllabusStatus === 'parsed' && parsedData ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ background: '#2ecc71', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>Parsed</span>
              <span style={{ fontSize: 13, color: '#666' }}>
                {parsedData.deadlines?.length || 0} deadlines, {parsedData.policies?.length || 0} policies, {parsedData.grading_weights?.length || 0} grading components
              </span>
            </div>

            {parsedData.deadlines?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, marginBottom: 8 }}>Deadlines</h4>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>
                      <th style={{ padding: 6 }}>Title</th>
                      <th style={{ padding: 6 }}>Type</th>
                      <th style={{ padding: 6 }}>Due Date</th>
                      <th style={{ padding: 6 }}>Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.deadlines.map((d: any) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: 6 }}>{d.title}</td>
                        <td style={{ padding: 6 }}>{d.type}</td>
                        <td style={{ padding: 6 }}>{d.due_date}</td>
                        <td style={{ padding: 6 }}>{d.weight ? `${(d.weight * 100).toFixed(0)}%` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {parsedData.policies?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, marginBottom: 8 }}>Policies</h4>
                {parsedData.policies.map((p: any) => (
                  <div key={p.id} style={{ marginBottom: 8, padding: 8, background: '#f9f9f9', borderRadius: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#f6821f' }}>{p.category}</span>
                    <p style={{ fontSize: 13, marginTop: 4 }}>{p.policy_text}</p>
                  </div>
                ))}
              </div>
            )}

            <button className="btn btn-secondary" onClick={() => setSyllabusStatus(null)}>Re-upload Syllabus</button>
          </div>
        ) : syllabusStatus === 'parsing' ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>Parsing syllabus...</p>
            <p style={{ fontSize: 13, color: '#666' }}>The AI is extracting deadlines, policies, and grading information.</p>
          </div>
        ) : (
          <form onSubmit={handleUpload}>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
              Paste your syllabus text below. The AI will extract deadlines, policies, grading weights, and office hours.
            </p>
            <textarea
              value={syllabusText}
              onChange={(e) => setSyllabusText(e.target.value)}
              placeholder="Paste your full syllabus text here..."
              rows={15}
              style={{ marginBottom: 12, fontFamily: 'monospace', fontSize: 13 }}
            />
            {error && <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 8 }}>{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={uploading || !syllabusText.trim()}>
              {uploading ? 'Uploading...' : 'Upload & Parse Syllabus'}
            </button>
          </form>
        )}
      </div>

      {/* Course Materials Upload */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Course Materials</h3>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!courseId || !materialTitle.trim() || !materialContent.trim()) return;
          setMaterialUploading(true);
          setMaterialError('');
          try {
            await api.uploadMaterial(courseId, {
              title: materialTitle,
              type: materialType,
              content: materialContent,
              week_number: materialWeek ? parseInt(materialWeek, 10) : undefined,
            });
            setMaterialTitle('');
            setMaterialType('Lecture Notes');
            setMaterialWeek('');
            setMaterialContent('');
            await loadMaterials();
          } catch (err: any) {
            setMaterialError(err.message);
          } finally {
            setMaterialUploading(false);
          }
        }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Title</label>
            <input
              value={materialTitle}
              onChange={(e) => setMaterialTitle(e.target.value)}
              placeholder="e.g. Week 3 Lecture Notes"
              required
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Type</label>
              <select
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }}
              >
                <option value="Lecture Notes">Lecture Notes</option>
                <option value="Slides">Slides</option>
                <option value="Resource">Resource</option>
                <option value="Announcement">Announcement</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Week Number (optional)</label>
              <input
                type="number"
                value={materialWeek}
                onChange={(e) => setMaterialWeek(e.target.value)}
                placeholder="e.g. 3"
                min={1}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Content</label>
            <textarea
              value={materialContent}
              onChange={(e) => setMaterialContent(e.target.value)}
              placeholder="Paste or type the material content here..."
              rows={8}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
              required
            />
          </div>
          {materialError && <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 8 }}>{materialError}</p>}
          <button type="submit" className="btn btn-primary" disabled={materialUploading || !materialTitle.trim() || !materialContent.trim()}>
            {materialUploading ? 'Uploading...' : 'Upload Material'}
          </button>
        </form>

        {/* Existing Materials List */}
        {materials.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Existing Materials</h4>
            {materials.map((m: any) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: '#f9f9f9', borderRadius: 6, marginBottom: 8 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: '#f6821f', fontWeight: 500, textTransform: 'uppercase' }}>{m.type}</span>
                  {m.week_number && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#999' }}>Week {m.week_number}</span>
                  )}
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '4px 8px', color: '#e74c3c' }}
                  onClick={async () => {
                    if (!courseId) return;
                    try {
                      await api.deleteMaterial(courseId, m.id);
                      await loadMaterials();
                    } catch (err: any) {
                      console.error(err);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reveal Key Modal */}
      {showKeyModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => { setShowKeyModal(false); setRevealedKey(null); setKeyError(''); }}>
          <div className="card" style={{ width: 420, padding: 28 }} onClick={(e) => e.stopPropagation()}>
            {revealedKey ? (
              <>
                <h3 style={{ marginBottom: 12 }}>Course Key</h3>
                <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
                  This key will hide automatically in 30 seconds.
                </p>
                <code style={{
                  display: 'block', background: '#f5f5f5', padding: 14, borderRadius: 6,
                  fontSize: 20, fontWeight: 700, textAlign: 'center', letterSpacing: 2,
                }}>
                  {revealedKey}
                </code>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 16, width: '100%' }}
                  onClick={() => { navigator.clipboard.writeText(revealedKey); }}
                >
                  Copy to Clipboard
                </button>
              </>
            ) : (
              <>
                <h3 style={{ marginBottom: 12 }}>Enter Your Password</h3>
                <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                  For security, enter your account password to reveal the course key.
                </p>
                <form onSubmit={handleRevealKey}>
                  <input
                    type="password"
                    value={keyPassword}
                    onChange={(e) => setKeyPassword(e.target.value)}
                    placeholder="Your password"
                    required
                    style={{ marginBottom: 12 }}
                  />
                  {keyError && (
                    <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 8 }}>{keyError}</p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-primary" disabled={keyLoading} style={{ flex: 1 }}>
                      {keyLoading ? 'Verifying...' : 'Reveal Key'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setShowKeyModal(false); setKeyError(''); }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
