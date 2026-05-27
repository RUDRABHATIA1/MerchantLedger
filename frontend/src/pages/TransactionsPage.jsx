import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { LoadingOverlay, Badge, Pagination, EmptyState, Amount, formatDate, getErrMsg } from '../components/UI';
import api from '../api/client';
import { Filter } from 'lucide-react';

export default function TransactionsPage() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/transactions', { params: { page, limit: 15, type, status } });
      setTransactions(res.data.data);
      setPages(res.data.pages);
      setError('');
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  }, [page, type, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <Layout onRefresh={load}>
      <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-300">
        <div className="mb-6">
          <h1 className="text-[1.4rem] font-bold mb-1">Journal Transactions</h1>
          <p className="text-[0.82rem] text-text-muted">Immutable ledger entries and history</p>
        </div>

        {error && <div className="px-4 py-3 bg-red-primary/10 border border-red-primary/30 text-red-300 rounded-md text-[0.855rem] mb-4">{error}</div>}

        <div className="card">
          <div className="flex flex-wrap items-center gap-4 mb-5">
            <div className="flex items-center gap-2">
              <Filter className="text-text-muted w-4 h-4" />
              <span className="text-sm text-text-secondary">Filters:</span>
            </div>
            
            <select className="form-select w-auto min-w-[140px]" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAWAL">Withdrawal</option>
              <option value="TRANSFER">Transfer</option>
              <option value="FEE">Fee</option>
              <option value="REFUND">Refund</option>
              <option value="REVERSAL">Reversal</option>
            </select>
            
            <select className="form-select w-auto min-w-[140px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="POSTED">Posted</option>
              <option value="REVERSED">Reversed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full border-collapse">
              <thead className="bg-bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Reference</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Type / Status</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Description</th>
                  <th className="px-4 py-3 text-right text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Posted By</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8"><LoadingOverlay /></td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState title="No transactions found" /></td></tr>
                ) : (
                  transactions.map(tx => (
                    <tr key={tx._id} className="cursor-pointer bg-bg-card hover:bg-bg-card-hover transition-colors" onClick={() => navigate(`/transactions/${tx._id}`)}>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color font-mono font-medium">{tx.reference}</td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">
                        <div className="flex flex-col items-start gap-1">
                          <Badge type={tx.type}>{tx.type}</Badge>
                          <Badge type={tx.status}>{tx.status}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-primary border-b border-border-color truncate max-w-[200px]">{tx.description}</td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-primary border-b border-border-color text-right">
                        <Amount value={tx.totalAmount} />
                        <div className="text-[0.7rem] text-text-muted font-mono">{tx.currency}</div>
                      </td>
                      <td className="px-4 py-3.5 text-[0.855rem] border-b border-border-color text-text-secondary">
                        {tx.createdBy?.name || 'System'}
                      </td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">{formatDate(tx.createdAt)}</td>
                    </tr>
                  ))
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
