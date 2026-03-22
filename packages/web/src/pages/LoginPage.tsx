import { useState } from 'react';
import { api } from '../api/client';

interface Props {
  onLogin: (token: string, user: any) => void;
}

export function LoginPage({ onLogin }: Props) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetDone, setResetDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.register({ email, name, password, role });
        onLogin(res.token, res.user);
      } else {
        const res = await api.login({ email, password });
        onLogin(res.token, res.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
      <div className="card" style={{ width: 400, padding: 32 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Course Agent</h1>
        <p style={{ color: '#666', marginBottom: 24 }}>AI-powered course assistant</p>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }}
                >
                  <option value="student">Student</option>
                  <option value="professor">Professor</option>
                  <option value="ta">TA</option>
                </select>
              </div>
            </>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" required />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
          </div>

          {error && <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: 12 }} disabled={loading}>
            {loading ? 'Loading...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {!isRegister && !showForgotPassword && (
          <p style={{ textAlign: 'center', marginTop: 12, fontSize: 13 }}>
            <button
              onClick={() => { setShowForgotPassword(true); setForgotSuccess(false); setForgotError(''); setForgotEmail(''); }}
              style={{ background: 'none', border: 'none', color: '#f6821f', cursor: 'pointer', fontWeight: 500 }}
            >
              Forgot Password?
            </button>
          </p>
        )}

        {showForgotPassword && (
          <div style={{ marginTop: 16, padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Reset Password</h4>
            {resetDone ? (
              <div>
                <p style={{ fontSize: 13, color: '#2ecc71', marginBottom: 8 }}>
                  Password reset successfully! You can now sign in with your new password.
                </p>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', fontSize: 13 }}
                  onClick={() => { setShowForgotPassword(false); setForgotSuccess(false); setResetDone(false); setResetToken(''); }}
                >
                  Back to Sign In
                </button>
              </div>
            ) : forgotSuccess ? (
              <div>
                <p style={{ fontSize: 13, color: '#2ecc71', marginBottom: 8 }}>
                  Enter the reset token and your new password below.
                </p>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setResetError('');
                  setResetLoading(true);
                  try {
                    await api.resetPassword(resetToken, newPassword);
                    setResetDone(true);
                  } catch (err: any) {
                    setResetError(err.message);
                  } finally {
                    setResetLoading(false);
                  }
                }}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Reset Token</label>
                    <input
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste the reset token"
                      required
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                    />
                  </div>
                  {resetError && <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 8 }}>{resetError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={resetLoading}>
                      {resetLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => { setShowForgotPassword(false); setForgotSuccess(false); setResetToken(''); }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setForgotError('');
                setForgotLoading(true);
                try {
                  const res = await api.forgotPassword(forgotEmail);
                  if ((res as any).reset_token) {
                    setResetToken((res as any).reset_token);
                  }
                  setForgotSuccess(true);
                } catch (err: any) {
                  setForgotError(err.message);
                } finally {
                  setForgotLoading(false);
                }
              }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@university.edu"
                    required
                  />
                </div>
                {forgotError && <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 8 }}>{forgotError}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={forgotLoading}>
                    {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => { setShowForgotPassword(false); setForgotError(''); }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); setShowForgotPassword(false); }}
            style={{ background: 'none', border: 'none', color: '#f6821f', cursor: 'pointer', fontWeight: 500 }}
          >
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  );
}
