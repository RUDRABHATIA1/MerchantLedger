import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { LoadingOverlay, formatCurrency, getErrMsg } from '../components/UI';
import api from '../api/client';
import { FileText, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('trial-balance'); // trial-balance, reconciliation

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [tbRes, recRes] = await Promise.all([
        api.get('/reports/trial-balance'),
        api.get('/reports/reconciliation'),
      ]);
      setData({ tb: tbRes.data.data, rec: recRes.data.data });
      setError('');
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <Layout><LoadingOverlay /></Layout>;
  if (error && !data) return <Layout><div className="p-8"><div className="px-4 py-3 bg-red-primary/10 border border-red-primary/30 text-red-300 rounded-md text-[0.855rem]">{error}</div></div></Layout>;

  return (
    <Layout onRefresh={load}>
      <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-300">
        <div className="mb-6">
          <h1 className="text-[1.4rem] font-bold mb-1">Reports</h1>
          <p className="text-[0.82rem] text-text-muted">Ledger analytics and compliance reports</p>
        </div>

        <div className="flex gap-1 p-1 bg-bg-surface rounded-lg w-max mb-6">
          <button 
            className={`px-5 py-2 rounded-md text-[0.82rem] font-medium transition-colors ${tab === 'trial-balance' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            onClick={() => setTab('trial-balance')}
          >
            Trial Balance
          </button>
          <button 
            className={`px-5 py-2 rounded-md text-[0.82rem] font-medium transition-colors ${tab === 'reconciliation' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            onClick={() => setTab('reconciliation')}
          >
            Reconciliation
          </button>
        </div>

        {tab === 'trial-balance' && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <div className="card mb-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-primary/20 text-blue-light flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Trial Balance</h2>
                    <p className="text-xs text-text-muted">Generated: {new Date(data.tb.generatedAt).toLocaleString()}</p>
                  </div>
                </div>
                {data.tb.totals.balanced ? (
                  <div className="flex items-center gap-2 text-green-light px-4 py-2 bg-green-primary/10 rounded-lg border border-green-primary/30">
                    <CheckCircle size={18} />
                    <span className="font-semibold text-sm">Ledger is Balanced</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-light px-4 py-2 bg-red-primary/10 rounded-lg border border-red-primary/30">
                    <AlertTriangle size={18} />
                    <span className="font-semibold text-sm">Ledger Imbalance Detected</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Debits (Assets + Expenses) */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-text-muted mb-4 border-b border-border-color pb-2">Debits</h3>
                  {data.tb.groups.filter(g => g.type === 'ASSET' || g.type === 'EXPENSE').map(g => (
                    <div key={g.type} className="mb-6">
                      <div className="text-blue-light font-semibold mb-2">{g.type}</div>
                      <div className="space-y-1">
                        {g.accounts.map(a => (
                          <div key={a.accountNumber} className="flex justify-between text-sm py-1">
                            <span className="text-text-secondary">{a.name} <span className="text-[0.65rem] text-text-muted font-mono ml-1">({a.accountNumber})</span></span>
                            <span className="font-mono">{formatCurrency(a.currentBalance)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-border-color">
                        <span>Total {g.type}</span>
                        <span className="font-mono">{formatCurrency(g.totalBalance)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between text-base font-bold mt-6 pt-3 border-t-2 border-border-color text-text-primary">
                    <span>Total Debits</span>
                    <span className="font-mono">{formatCurrency(data.tb.totals.totalDebits)}</span>
                  </div>
                </div>

                {/* Credits (Liabilities + Income + Equity) */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-text-muted mb-4 border-b border-border-color pb-2">Credits</h3>
                  {data.tb.groups.filter(g => g.type === 'LIABILITY' || g.type === 'INCOME' || g.type === 'EQUITY').map(g => (
                    <div key={g.type} className="mb-6">
                      <div className="text-gold font-semibold mb-2">{g.type}</div>
                      <div className="space-y-1">
                        {g.accounts.map(a => (
                          <div key={a.accountNumber} className="flex justify-between text-sm py-1">
                            <span className="text-text-secondary">{a.name} <span className="text-[0.65rem] text-text-muted font-mono ml-1">({a.accountNumber})</span></span>
                            <span className="font-mono">{formatCurrency(a.currentBalance)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-border-color">
                        <span>Total {g.type}</span>
                        <span className="font-mono">{formatCurrency(g.totalBalance)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between text-base font-bold mt-6 pt-3 border-t-2 border-border-color text-text-primary">
                    <span>Total Credits</span>
                    <span className="font-mono">{formatCurrency(data.tb.totals.totalCredits)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'reconciliation' && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="card bg-bg-card border border-border-color p-5 text-center">
                <div className="text-3xl font-bold text-text-primary mb-1">{data.rec.totalChecked}</div>
                <div className="text-sm text-text-muted uppercase tracking-wider">Transactions Verified</div>
              </div>
              <div className="card bg-green-primary/5 border border-green-primary/20 p-5 text-center">
                <div className="text-3xl font-bold text-green-light mb-1">{data.rec.balanced}</div>
                <div className="text-sm text-green-primary uppercase tracking-wider">Balanced</div>
              </div>
              <div className={`card p-5 text-center ${data.rec.unbalanced > 0 ? 'bg-red-primary/10 border-red-primary/30' : 'bg-bg-card border-border-color'}`}>
                <div className={`text-3xl font-bold mb-1 ${data.rec.unbalanced > 0 ? 'text-red-light' : 'text-text-primary'}`}>{data.rec.unbalanced}</div>
                <div className={`text-sm uppercase tracking-wider ${data.rec.unbalanced > 0 ? 'text-red-primary' : 'text-text-muted'}`}>Unbalanced (Anomalies)</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
