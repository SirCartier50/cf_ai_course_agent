import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export function StudentDashboard() {
  const [courses, setCourses] = useState<any[]>([]);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [courseKey, setCourseKey] = useState('');
  const [studentId, setStudentId] = useState('');
  const [enrollError, setEnrollError] = useState('');
  const [enrollSuccess, setEnrollSuccess] = useState<any>(null);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.listCourses().then((res) => setCourses(res.courses));
  }, []);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError('');
    setEnrollLoading(true);

    try {
      const res = await api.enrollInCourse(courseKey.trim(), studentId.trim());
      setEnrollSuccess(res.course);
      // Refresh courses
      const coursesRes = await api.listCourses();
      setCourses(coursesRes.courses);
    } catch (err: any) {
      setEnrollError(err.message);
    } finally {
      setEnrollLoading(false);
    }
  };

  const closeModals = () => {
    setShowEnrollModal(false);
    setEnrollSuccess(null);
    setEnrollError('');
    setCourseKey('');
    setStudentId('');
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>My Courses</h2>
        <button className="btn btn-primary" onClick={() => setShowEnrollModal(true)}>
          Add Course
        </button>
      </div>

      {/* Course grid */}
      {courses.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#666', marginBottom: 8 }}>No courses yet.</p>
          <p style={{ color: '#999', fontSize: 13 }}>Click "Add Course" and enter the course key and student ID provided by your professor.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {courses.map((course) => (
            <div
              key={course.id}
              className="card"
              style={{ cursor: 'pointer', transition: 'box-shadow 0.2s' }}
              onClick={() => navigate(`/course/${course.id}`)}
            >
              <h3 style={{ marginBottom: 4 }}>{course.code}</h3>
              <p style={{ color: '#666', fontSize: 14 }}>{course.title}</p>
              <p style={{ color: '#999', fontSize: 12, marginTop: 8 }}>{course.term}</p>
            </div>
          ))}
        </div>
      )}

      {/* Enroll Modal */}
      {showEnrollModal && !enrollSuccess && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={closeModals}>
          <div className="card" style={{ width: 420, padding: 28 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>Add Course</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              Enter the course key and your student ID. Your professor should have provided these to you.
            </p>
            <form onSubmit={handleEnroll}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Course Key</label>
                <input
                  value={courseKey}
                  onChange={(e) => setCourseKey(e.target.value)}
                  placeholder="e.g. CSE183-A7X9K2"
                  required
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Your Student ID</label>
                <input
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. STU-A3X9K2"
                  required
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              {enrollError && (
                <div style={{ background: '#fee', border: '1px solid #fcc', borderRadius: 6, padding: 10, marginBottom: 12 }}>
                  <p style={{ color: '#c0392b', fontSize: 13 }}>{enrollError}</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={enrollLoading} style={{ flex: 1 }}>
                  {enrollLoading ? 'Enrolling...' : 'Enroll'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeModals}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {enrollSuccess && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={closeModals}>
          <div className="card" style={{ width: 380, padding: 28, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
            <h3 style={{ marginBottom: 8, color: '#2ecc71' }}>Course Added!</h3>
            <p style={{ fontSize: 14, marginBottom: 4 }}>
              <strong>{enrollSuccess.code}</strong> - {enrollSuccess.title}
            </p>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
              You're now enrolled. Click the course on your dashboard to start chatting with the AI TA.
            </p>
            <button className="btn btn-primary" onClick={closeModals} style={{ width: '100%' }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
