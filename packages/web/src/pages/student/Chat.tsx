import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls?: string;
  metadata?: string;
  created_at: string;
}

export function StudentChat() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [course, setCourse] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (courseId) {
      api.getCourse(courseId).then((res) => setCourse(res.course));
    }
  }, [courseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !courseId || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Optimistically add user message
    const tempId = 'temp-' + Date.now();
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content: userMessage, created_at: new Date().toISOString() }]);

    try {
      const res = await api.sendMessage(courseId, userMessage, conversationId);
      setConversationId(res.conversation_id);

      // Add assistant response
      setMessages((prev) => [...prev, {
        id: res.message.id,
        role: 'assistant',
        content: res.message.content,
        tool_calls: res.message.tool_calls ? JSON.stringify(res.message.tool_calls) : undefined,
        metadata: res.message.metadata ? JSON.stringify(res.message.metadata) : undefined,
        created_at: new Date().toISOString(),
      }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        id: 'error-' + Date.now(),
        role: 'system',
        content: `Error: ${err.message}`,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const renderToolCalls = (toolCallsStr?: string) => {
    if (!toolCallsStr) return null;
    try {
      const calls = JSON.parse(toolCallsStr);
      return (
        <div style={{ fontSize: 11, color: '#888', marginTop: 4, fontStyle: 'italic' }}>
          Tools used: {calls.map((tc: any) => tc.name).join(', ')}
        </div>
      );
    } catch {
      return null;
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #eee', background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 13, padding: '4px 10px' }}
            onClick={() => navigate('/')}
          >
            &larr; Back
          </button>
          <div>
            <h2 style={{ fontSize: 18 }}>{course?.code} - {course?.title}</h2>
            <p style={{ fontSize: 12, color: '#666' }}>Ask questions about the course, check deadlines, calculate grades, or request accommodations.</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#999', marginTop: 60 }}>
            <p style={{ fontSize: 18, marginBottom: 8 }}>Welcome to your Course Assistant</p>
            <p style={{ fontSize: 14 }}>Try asking:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, maxWidth: 400, margin: '16px auto' }}>
              {[
                'When is the next assignment due?',
                'What is the late work policy?',
                'What do I need on the final to get a B?',
                'I was sick and missed class, what should I do?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="card"
                  style={{ textAlign: 'left', cursor: 'pointer', fontSize: 14, border: '1px solid #eee' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                maxWidth: '70%',
                padding: '10px 14px',
                borderRadius: 12,
                background: msg.role === 'user' ? '#f6821f' : msg.role === 'system' ? '#fee' : 'white',
                color: msg.role === 'user' ? 'white' : '#1a1a1a',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>{msg.content}</div>
              {msg.role === 'assistant' && renderToolCalls(msg.tool_calls)}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{ padding: '10px 14px', borderRadius: 12, background: 'white', color: '#999', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{ padding: '12px 20px', borderTop: '1px solid #eee', background: 'white', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your course assistant..."
          style={{ flex: 1 }}
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
