import React, { useState, useEffect } from 'react';
import { authApi } from '../services/api';

export default function AuthModal({ show, onClose, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Clear fields whenever modal opens so no default values linger
  useEffect(() => {
    if (show) {
      setEmail('');
      setPassword('');
      setFullName('');
      setError(null);
    }
  }, [show]);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let res;
      if (isLogin) {
        res = await authApi.login(email, password);
      } else {
        res = await authApi.register(fullName, email, password);
      }

      const { user, token } = res.data.data;
      localStorage.setItem('seatlock_token', token);
      onAuthSuccess(user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)' }}>
          <div className="modal-header border-0 px-4 pt-4 pb-2" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
            <h5 className="modal-title fw-bold text-white">
              {isLogin ? 'Sign In to SeatLock' : 'Create Customer Account'}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4">
            {error && (
              <div className="alert alert-danger py-2 small mb-3">
                <i className="bi bi-exclamation-triangle-fill me-1"></i> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="off">
              {!isLogin && (
                <div className="mb-3">
                  <label htmlFor="auth-fullname" className="form-label small text-muted fw-bold">Full Name</label>
                  <input
                    id="auth-fullname"
                    name="fullName"
                    type="text"
                    className="form-control rounded-3"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    autoComplete="off"
                  />
                </div>
              )}
              <div className="mb-3">
                <label htmlFor="auth-email" className="form-label small text-muted fw-bold">Email address</label>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  className="form-control rounded-3"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  autoComplete="off"
                />
              </div>
              <div className="mb-3">
                <label htmlFor="auth-password" className="form-label small text-muted fw-bold">Password</label>
                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  className="form-control rounded-3"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="new-password"
                />
              </div>

              <button 
                type="submit" 
                className="btn rounded-pill w-100 fw-bold py-2 mb-3 shadow-sm d-flex align-items-center justify-content-center gap-2" 
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.95rem'
                }}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>Authenticating...</span>
                  </>
                ) : isLogin ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="text-center mt-3 pt-3 border-top">
              <button
                className="btn btn-link btn-sm text-primary text-decoration-none fw-bold"
                onClick={() => { 
                  setIsLogin(!isLogin); 
                  setEmail('');
                  setPassword('');
                  setFullName('');
                  setError(null); 
                }}
              >
                {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
