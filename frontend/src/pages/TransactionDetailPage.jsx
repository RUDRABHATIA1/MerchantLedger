import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { LoadingOverlay, Badge, Amount, formatDate, getErrMsg, ConfirmModal } from '../components/UI';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, RefreshCcw, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TransactionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isTeller, isAdmin } = useAuth();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showReverse, setShowReverse] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [reverseReason, setReverseReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/transactions/${id}`);
      setData(res.data.data);
      setError('');
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleReverse = async () => {
    setActionLoading(true);
    try {
      await api.post(`/transactions/${id}/reverse`, { description: reverseReason });
      toast.success('Transaction reversed successfully');
      setShowReverse(false);
      load();
    } catch (err) {
      toast.error(getErrMsg(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCapture = async () => {
    setActionLoading(true);
    try {
      await api.post(`/transactions/${id}/capture`);
      toast.success('Transaction captured and posted');
      setShowCapture(false);
      load();
    } catch (err) {
      toast.error(getErrMsg(err));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) return <Layout><LoadingOverlay /></Layout>;
  if (error && !data) return <Layout><div className="p-8"><div className="px-4 py-3 bg-red-primary/10 border border-red-primary/30 text-red-300 rounded-md text-[0.855rem]">{error}</div></div></Layout>;

  const { transaction: tx, entries } = data;

  return (
    <Layout onRefresh={load}>
      <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-300">
        <button 
          className="btn btn-ghost btn-sm mb-6 text-text-secondary hover:text-text-primary px-0 hover:bg-transparent" 
          onClick={() => navigate('/transactions')}
        >
          <ArrowLeft size={16} /> Back to Transactions
        </button>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-[1.4rem] font-bold font-mono">{tx.reference}</h1>
              <Badge type={tx.status}>{tx.status}</Badge>
            </div>
            <p className="text-[0.82rem] text-text-muted">{tx.description}</p>
          </div>
          
          <div className="flex gap-2.5">
            {tx.status === 'PENDING' && isTeller && (
              <button className="btn btn-success" onClick={() => setShowCapture(true)}>
                <CheckCircle size={16} /> Capture (Post)
              </button>
            )}
            {tx.status === 'POSTED' && isAdmin && (
              <button className="btn btn-danger" onClick={() => setShowReverse(true)}>
                <RefreshCcw size={16} /> Reverse
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h3 className="section-title">Transaction Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-border-color pb-2">
                <span className="text-text-secondary text-sm">Type</span>
                <Badge type={tx.type}>{tx.type}</Badge>
              </div>
              <div className="flex justify-between border-b border-border-color pb-2">
                <span className="text-text-secondary text-sm">Total Amount</span>
                <span className="font-mono font-semibold text-text-primary">{formatCurrency(tx.totalAmount)} {tx.currency}</span>
              </div>
              <div className="flex justify-between border-b border-border-color pb-2">
                <span className="text-text-secondary text-sm">Date Created</span>
                <span className="text-sm">{formatDate(tx.createdAt)}</span>
              </div>
              <div className="flex justify-between border-b border-border-color pb-2">
                <span className="text-text-secondary text-sm">Date Posted</span>
                <span className="text-sm">{tx.postedAt ? formatDate(tx.postedAt) : '—'}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-text-secondary text-sm">Posted By</span>
                <span className="text-sm text-text-primary font-medium">{tx.createdBy?.name || 'System'}</span>
              </div>
            </div>
          </div>
          
          {(tx.reversalOf || tx.reversedBy) && (
            <div className="card">
              <h3 className="section-title">Reversal Info</h3>
              <div className="space-y-3">
                {tx.reversalOf && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary text-sm">Reversal of</span>
                    <button className="text-blue-light hover:underline font-mono text-sm" onClick={() => navigate(`/transactions/${tx.reversalOf._id}`)}>
                      {tx.reversalOf.reference}
                    </button>
                  </div>
                )}
                {tx.reversedBy && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary text-sm">Reversed by</span>
                    <button className="text-blue-light hover:underline font-mono text-sm" onClick={() => navigate(`/transactions/${tx.reversedBy._id}`)}>
                      {tx.reversedBy.reference}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="section-title">Journal Entries (Double-Entry)</h3>
          <div className="overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full border-collapse">
              <thead className="bg-bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Account</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">GL Type</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Direction</th>
                  <th className="px-4 py-3 text-right text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Debit</th>
                  <th className="px-4 py-3 text-right text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Credit</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">State</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e._id} className="bg-bg-card hover:bg-bg-card-hover transition-colors">
                    <td className="px-4 py-3.5 text-[0.855rem] text-text-primary border-b border-border-color">
                      <div className="font-medium">{e.accountId.name}</div>
                      <div className="font-mono text-[0.7rem] text-text-muted">{e.accountId.accountNumber}</div>
                    </td>
                    <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">
                      <Badge type={e.accountId.type}>{e.accountId.type}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">
                      <Badge type={e.direction}>{e.direction}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color text-right font-mono">
                      {e.direction === 'DEBIT' ? <Amount value={e.amount} prefix="" /> : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color text-right font-mono">
                      {e.direction === 'CREDIT' ? <Amount value={e.amount} prefix="" /> : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">
                      {e.isImmutable ? <span className="text-[0.75rem] text-text-muted flex items-center gap-1">🔒 Immutable</span> : <span className="text-[0.75rem] text-text-muted">Pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reversal Modal */}
      {showReverse && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-[4px] z-[1000] flex items-center justify-center p-5">
          <div className="bg-bg-card border border-border-light rounded-2xl w-full max-w-[520px] shadow-modal animate-in slide-in-from-bottom-4 duration-200">
            <div className="px-6 pt-5 pb-4 border-b border-border-color flex items-center justify-between">
              <span className="text-base font-semibold text-red-light flex items-center gap-2"><RefreshCcw size={18} /> Reverse Transaction</span>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowReverse(false)} disabled={actionLoading}>✕</button>
            </div>
            <div className="p-6">
              <p className="text-text-secondary text-[0.9rem] mb-4">
                This will create a new equal-and-opposite transaction to reverse the effects of <strong className="font-mono text-text-primary">{tx.reference}</strong>. 
                The original transaction will remain in the ledger as an immutable record.
              </p>
              <div className="form-group mb-0">
                <label className="form-label">Reversal Reason</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., Customer requested refund, error in posting..." 
                  value={reverseReason} 
                  onChange={e => setReverseReason(e.target.value)} 
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border-color flex justify-end gap-2.5">
              <button className="btn btn-secondary" onClick={() => setShowReverse(false)} disabled={actionLoading}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReverse} disabled={actionLoading}>
                {actionLoading ? 'Reversing...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Capture Confirm */}
      <ConfirmModal 
        open={showCapture} 
        onClose={() => setShowCapture(false)}
        onConfirm={handleCapture}
        title="Capture Pending Transaction"
        message="This will post the transaction to the ledger, making the entries immutable and updating the current balances. Are you sure?"
      />
    </Layout>
  );
}
