import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { LoadingOverlay, Badge, Amount, Pagination, EmptyState, formatDate, getErrMsg } from '../components/UI';
import api from '../api/client';
import { ArrowLeft, Landmark } from 'lucide-react';
import { Line } from 'react-chartjs-2';

export default function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/accounts/${id}/statement`, { params: { page, limit: 15 } });
      // We also need the full account details
      const accRes = await api.get(`/accounts/${id}`);
      setData({ account: accRes.data.data, statement: res.data.data });
      setPages(res.data.pages);
      setError('');
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  }, [id, page]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <Layout><LoadingOverlay /></Layout>;
  if (error && !data) return <Layout><div className="p-8"><div className="px-4 py-3 bg-red-primary/10 border border-red-primary/30 text-red-300 rounded-md text-[0.855rem]">{error}</div></div></Layout>;

  const { account, statement } = data;

  return (
    <Layout onRefresh={load}>
      <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-300">
        <button 
          className="btn btn-ghost btn-sm mb-6 text-text-secondary hover:text-text-primary px-0 hover:bg-transparent" 
          onClick={() => navigate('/accounts')}
        >
          <ArrowLeft size={16} /> Back to Accounts
        </button>
        
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-bg-card border border-border-color flex items-center justify-center text-blue-light shadow-sm">
                <Landmark size={20} />
              </div>
              <div>
                <h1 className="text-[1.4rem] font-bold leading-tight">{account.name}</h1>
                <div className="text-[0.85rem] text-text-muted font-mono">{account.accountNumber}</div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <Badge type={account.type}>{account.type}</Badge>
              <span className="text-sm text-text-secondary px-2 py-0.5 rounded border border-border-color bg-bg-surface">{account.subtype.replace('_', ' ')}</span>
              <Badge type={account.status}>{account.status}</Badge>
              {account.partyId && (
                <button 
                  className="text-sm text-blue-light hover:underline ml-2" 
                  onClick={() => navigate(`/parties/${account.partyId._id}`)}
                >
                  Owner: {account.partyId.name}
                </button>
              )}
            </div>
          </div>
          
          <div className="card p-5 bg-gradient-to-br from-bg-card to-bg-surface shadow-xl">
            <div className="text-[0.72rem] text-text-muted uppercase tracking-wider mb-2 font-semibold">Available Balance</div>
            <div className="text-3xl font-bold font-mono text-text-primary mb-3">
              <Amount value={account.availableBalance} prefix="" /> <span className="text-lg text-text-muted">{account.currency}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-border-color">
              <span className="text-[0.75rem] text-text-secondary">Current Balance (Incl. Holds)</span>
              <span className="text-[0.75rem] font-mono font-medium"><Amount value={account.currentBalance} prefix="" /></span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-semibold">Ledger Statement</h3>
            {/* Optional: Add date range filters here */}
          </div>
          
          <div className="overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full border-collapse">
              <thead className="bg-bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Transaction Ref</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Description</th>
                  <th className="px-4 py-3 text-right text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Debit</th>
                  <th className="px-4 py-3 text-right text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Credit</th>
                  <th className="px-4 py-3 text-center text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">State</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8"><LoadingOverlay /></td></tr>
                ) : statement.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState title="No entries in this account" /></td></tr>
                ) : (
                  statement.map(e => {
                    const tx = e.transactionId || {};
                    return (
                      <tr key={e._id} className="bg-bg-card hover:bg-bg-card-hover transition-colors">
                        <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">{formatDate(e.createdAt)}</td>
                        <td className="px-4 py-3.5 text-[0.855rem] border-b border-border-color">
                          <button 
                            className="font-mono text-blue-light hover:underline font-medium"
                            onClick={() => navigate(`/transactions/${tx._id}`)}
                          >
                            {tx.reference || '—'}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-[0.855rem] text-text-primary border-b border-border-color max-w-[200px] truncate">{e.description}</td>
                        <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color text-right font-mono">
                          {e.direction === 'DEBIT' ? <Amount value={e.amount} prefix="" className="text-text-primary" /> : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color text-right font-mono">
                          {e.direction === 'CREDIT' ? <Amount value={e.amount} prefix="" className="text-text-primary" /> : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color text-center">
                          {e.state === 'POSTED' ? <span className="text-green-light text-[0.7rem] uppercase tracking-wider font-semibold">Posted</span> : <span className="text-yellow-400 text-[0.7rem] uppercase tracking-wider font-semibold">Pending</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          <Pagination page={page} pages={pages} onPage={setPage} />
        </div>
      </div>
    </Layout>
  );
}
