import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

function containsInappropriate(text: string): boolean {
  const flags = ['fuck', 'shit', 'damn', 'ass', 'hell', 'bitch', 'dick', 'porn', 'sex', 'kill', 'die', 'hate'];
  const lower = text.toLowerCase();
  return flags.some(word => lower.includes(word));
}

export function ProfessorTickets() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [filter, setFilter] = useState('open');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [response, setResponse] = useState('');
  const [absorb, setAbsorb] = useState(true);
  const [loading, setLoading] = useState(false);
  const [revealedTickets, setRevealedTickets] = useState<Set<string>>(new Set());

  const loadTickets = async () => {
    if (!courseId) return;
    const res = await api.listTickets(courseId, filter === 'all' ? undefined : filter);
    setTickets(res.tickets);
  };

  useEffect(() => {
    loadTickets();
  }, [courseId, filter]);

  const handleResolve = async (status: 'resolved' | 'denied') => {
    if (!courseId || !selectedTicket || !response.trim()) return;
    setLoading(true);
    try {
      await api.resolveTicket(courseId, selectedTicket.id, {
        status,
        professor_response: response,
        absorb_to_knowledge_base: absorb,
      });
      setSelectedTicket(null);
      setResponse('');
      await loadTickets();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statusColor: Record<string, string> = {
    open: '#e74c3c',
    in_progress: '#f39c12',
    awaiting_student: '#3498db',
    resolved: '#2ecc71',
    denied: '#95a5a6',
  };

  const priorityColor: Record<string, string> = {
    urgent: '#e74c3c',
    high: '#f39c12',
    normal: '#3498db',
    low: '#95a5a6',
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-secondary" style={{ fontSize: 13, padding: '4px 10px' }} onClick={() => navigate(`/course/${courseId}`)}>
          &larr; Back
        </button>
        <h2>Tickets</h2>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['open', 'in_progress', 'resolved', 'denied', 'all'].map((f) => (
          <button
            key={f}
            className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f)}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedTicket ? '1fr 1fr' : '1fr', gap: 20 }}>
        <div>
          {tickets.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 24, color: '#666' }}>
              No {filter === 'all' ? '' : filter} tickets
            </div>
          ) : (
            tickets.map((ticket) => {
              const isFlagged = containsInappropriate(ticket.subject || '') || containsInappropriate(ticket.description || '');
              const isRevealed = revealedTickets.has(ticket.id);
              return (
                <div
                  key={ticket.id}
                  className="card"
                  style={{ marginBottom: 8, cursor: 'pointer', border: selectedTicket?.id === ticket.id ? '2px solid #f6821f' : '2px solid transparent' }}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{ticket.subject}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isFlagged && (
                        <span style={{ background: '#e74c3c', color: 'white', padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 700 }}>
                          Flagged
                        </span>
                      )}
                      <span style={{ background: priorityColor[ticket.priority] || '#999', color: 'white', padding: '1px 6px', borderRadius: 3, fontSize: 11 }}>
                        {ticket.priority}
                      </span>
                      <span style={{ background: statusColor[ticket.status] || '#999', color: 'white', padding: '1px 6px', borderRadius: 3, fontSize: 11 }}>
                        {ticket.status}
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{ticket.student_name} - {ticket.category}</p>
                  {isFlagged && !isRevealed ? (
                    <div style={{ marginTop: 4 }}>
                      <p style={{ fontSize: 12, color: '#999', filter: 'blur(4px)', userSelect: 'none' }}>
                        {ticket.description?.slice(0, 100)}...
                      </p>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 11, padding: '2px 8px', marginTop: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRevealedTickets((prev) => new Set(prev).add(ticket.id));
                        }}
                      >
                        Show content
                      </button>
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{ticket.description?.slice(0, 100)}...</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {selectedTicket && (
          <div className="card" style={{ position: 'sticky', top: 20, alignSelf: 'start' }}>
            <h3 style={{ marginBottom: 4 }}>{selectedTicket.subject}</h3>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
              From: {selectedTicket.student_name} ({selectedTicket.student_email}) | Category: {selectedTicket.category}
            </p>

            {selectedTicket.agent_summary && (
              <div style={{ background: '#f0f7ff', padding: 10, borderRadius: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#3498db' }}>AI Summary</span>
                <p style={{ fontSize: 13, marginTop: 4 }}>{selectedTicket.agent_summary}</p>
              </div>
            )}

            <div style={{ background: '#f9f9f9', padding: 10, borderRadius: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600 }}>Student's Question</span>
              <p style={{ fontSize: 13, marginTop: 4 }}>{selectedTicket.description}</p>
            </div>

            {selectedTicket.status === 'open' || selectedTicket.status === 'in_progress' ? (
              <>
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Type your response to the student..."
                  rows={4}
                  style={{ marginBottom: 8 }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}>
                  <input type="checkbox" checked={absorb} onChange={(e) => setAbsorb(e.target.checked)} />
                  Save this answer for future students with similar questions
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => handleResolve('resolved')} disabled={loading || !response.trim()}>
                    Resolve
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleResolve('denied')} disabled={loading || !response.trim()}>
                    Deny
                  </button>
                </div>
              </>
            ) : (
              <div style={{ background: '#f0fff0', padding: 10, borderRadius: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#2ecc71' }}>Response</span>
                <p style={{ fontSize: 13, marginTop: 4 }}>{selectedTicket.professor_response}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
