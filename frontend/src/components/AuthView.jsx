import React, { useState } from 'react';
import { apiRequest, setAuthToken } from '../api';
import { Shield, Store, ShoppingBag, ArrowRight } from 'lucide-react';

export default function AuthView({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'buyer',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    try {
      const res = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      setAuthToken(res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (email, password) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '3rem auto' }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 600 }}>
            {isLogin ? 'Sign In to Platform' : 'Create an Account'}
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Multi-role marketplace with Admin AI Tool Calling
          </p>
        </div>

        {error && (
          <div className="alert-banner warning" style={{ marginBottom: '1rem', background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                required
                className="input-text"
                placeholder="Jane Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              required
              className="input-text"
              placeholder="user@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              required
              className="input-text"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Register As</label>
              <select
                className="input-select"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="buyer">Buyer (Purchase products)</option>
                <option value="seller">Seller (Manage products & orders)</option>
              </select>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8125rem' }}
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>

        {/* Demo Quick Logins */}
        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', textAlign: 'center' }}>
            Quick Demo Logins
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flexDirection: 'column', padding: '0.5rem 0.25rem', gap: '0.2rem' }}
              onClick={() => handleQuickLogin('admin@marketplace.com', 'adminpassword123')}
            >
              <Shield size={14} />
              <span style={{ fontSize: '0.7rem' }}>Admin</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flexDirection: 'column', padding: '0.5rem 0.25rem', gap: '0.2rem' }}
              onClick={() => handleQuickLogin('seller@apex.com', 'sellerpassword123')}
            >
              <Store size={14} />
              <span style={{ fontSize: '0.7rem' }}>Seller</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flexDirection: 'column', padding: '0.5rem 0.25rem', gap: '0.2rem' }}
              onClick={() => handleQuickLogin('alice@example.com', 'buyerpassword123')}
            >
              <ShoppingBag size={14} />
              <span style={{ fontSize: '0.7rem' }}>Buyer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
