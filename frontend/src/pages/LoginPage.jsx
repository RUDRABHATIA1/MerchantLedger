import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrMsg } from '../components/UI';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fill = (email, password) => setForm({ email, password });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-5 bg-bg-base overflow-hidden">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-primary/10 rounded-full blur-[100px] animate-pulse-glow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-primary/10 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-[420px] relative z-10 animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-9">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-primary to-purple-primary flex items-center justify-center text-[32px] mx-auto mb-4 shadow-glow animate-float">
            💳
          </div>
          <h1 className="text-3xl font-extrabold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-blue-light to-purple-primary">PaymentLedger</h1>
          <p className="text-text-muted text-[0.85rem] tracking-wide">Core Banking Ledger System</p>
        </div>

        {/* Card */}
        <div className="card p-8 shadow-[0_8px_40px_rgba(0,0,0,0.5)] border-border-color/50 bg-bg-card/80 backdrop-blur-xl">
          <h2 className="text-[1.1rem] font-semibold mb-1.5">Sign in to portal</h2>
          <p className="text-text-muted text-sm mb-6">Enter your credentials to access the ledger</p>

          {error && (
            <div className="px-4 py-3 bg-red-primary/10 border border-red-primary/30 text-red-300 rounded-md text-[0.855rem] mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email address <span>*</span></label>
              <input id="login-email" className="form-input" type="email" placeholder="admin@ledger.dev" value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password <span>*</span></label>
              <input id="login-password" className="form-input" type="password" placeholder="••••••••" value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <button id="login-submit" className="btn btn-primary btn-lg w-full justify-center mt-1" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Demo credentials */}
        <div className="card p-4 mt-4 shadow-lg border-dashed">
          <div className="text-[0.72rem] text-text-muted uppercase tracking-wider mb-2.5 font-semibold">Demo Credentials</div>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Admin', email: 'admin@ledger.dev', pwd: 'Admin@1234', colorClass: 'text-purple-primary' },
              { label: 'Teller', email: 'teller@ledger.dev', pwd: 'Teller@1234', colorClass: 'text-blue-light' },
              { label: 'Auditor', email: 'auditor@ledger.dev', pwd: 'Audit@1234', colorClass: 'text-text-muted' },
            ].map(({ label, email, pwd, colorClass }) => (
              <button key={label} className="btn btn-secondary btn-sm justify-start gap-2.5 hover:bg-bg-surface"
                onClick={() => fill(email, pwd)}>
                <span className={`${colorClass} font-bold text-[0.7rem] uppercase min-w-[52px] text-left`}>{label}</span>
                <span className="font-mono text-text-secondary">{email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
