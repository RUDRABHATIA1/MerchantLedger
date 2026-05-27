import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { LoadingOverlay, Badge, Pagination, EmptyState, Amount, getErrMsg, Modal } from '../components/UI';
import api from '../api/client';
import { Search, Plus, Filter } from 'lucide-react';

export default function AccountsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [formData, setFormData] = useState({ partyId: '', name: 'Main Wallet', type: 'LIABILITY', subtype: 'CUSTOMER_WALLET', currency: 'USD' });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [parties, setParties] = useState([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/accounts', { params: { page, limit: 15, search, type } });
      setAccounts(res.data.data);
      setPages(res.data.pages);
      setError('');
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, type]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') { setPage(1); load(); }
  };

  useEffect(() => {
    if (createModal && parties.length === 0) {
      api.get('/parties', { params: { limit: 100 } })
         .then(res => setParties(res.data.data))
         .catch(err => console.error(err));
    }
  }, [createModal, parties.length]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      await api.post('/accounts', formData);
      setCreateModal(false);
      setFormData({ partyId: '', name: 'Main Wallet', type: 'LIABILITY', subtype: 'CUSTOMER_WALLET', currency: 'USD' });
      load();
    } catch (err) {
      alert(getErrMsg(err));
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Layout onRefresh={load}>
      <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-[1.4rem] font-bold mb-1">Chart of Accounts</h1>
            <p className="text-[0.82rem] text-text-muted">GL and customer ledger accounts</p>
          </div>
          <button className="btn btn-primary" onClick={() => setCreateModal(true)}>
            <Plus size={16} /> New Account
          </button>
        </div>

        {error && <div className="px-4 py-3 bg-red-primary/10 border border-red-primary/30 text-red-300 rounded-md text-[0.855rem] mb-4">{error}</div>}

        <div className="card">
          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
              <input
                type="text"
                className="form-input pl-9"
                placeholder="Search account number or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearch}
              />
            </div>
            <div className="relative flex items-center">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4 pointer-events-none" />
              <select className="form-select w-auto min-w-[140px] pl-9" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
                <option value="">All Types</option>
                <option value="ASSET">Asset (GL)</option>
                <option value="LIABILITY">Liability</option>
                <option value="INCOME">Income (GL)</option>
                <option value="EXPENSE">Expense (GL)</option>
                <option value="EQUITY">Equity (GL)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full border-collapse">
              <thead className="bg-bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Account Number</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Type / Subtype</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Available Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-8"><LoadingOverlay /></td></tr>
                ) : accounts.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState title="No accounts found" /></td></tr>
                ) : (
                  accounts.map(a => (
                    <tr key={a._id} className="cursor-pointer bg-bg-card hover:bg-bg-card-hover transition-colors" onClick={() => navigate(`/accounts/${a._id}`)}>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color font-mono">{a.accountNumber}
                        {a.isSystemAccount && <span className="ml-2 text-[0.65rem] bg-blue-primary/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-primary/30">GL</span>}
                      </td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-primary border-b border-border-color font-medium">{a.name}
                        {a.partyId && <div className="text-[0.75rem] text-text-muted font-normal mt-0.5">{a.partyId.name}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">
                        <div className="flex flex-col items-start gap-1">
                          <Badge type={a.type}>{a.type}</Badge>
                          <span className="text-[0.7rem] text-text-muted">{a.subtype.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">
                        <Badge type={a.status}>{a.status}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color text-right">
                        <div className="flex flex-col items-end">
                          <Amount value={a.availableBalance} className={a.availableBalance < 0 ? 'text-red-primary' : 'text-text-primary text-base'} />
                          <span className="text-[0.7rem] text-text-muted font-mono">{a.currency}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <Pagination page={page} pages={pages} onPage={setPage} />
        </div>
      </div>

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create New Account">
        <form onSubmit={handleCreate} className="p-6">
          <div className="form-group">
            <label className="form-label">Party (Customer) <span>*</span></label>
            <select className="form-select" required value={formData.partyId} onChange={e => setFormData({...formData, partyId: e.target.value})}>
              <option value="">Select a party</option>
              {parties.map(p => (
                <option key={p._id} value={p._id}>{p.name} ({p.type})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Account Name <span>*</span></label>
            <input className="form-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Main Wallet" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Type <span>*</span></label>
              <select className="form-select" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="LIABILITY">Liability (Customer)</option>
                <option value="ASSET">Asset (Bank)</option>
              </select>
            </div>
            <div className="form-group mb-6">
              <label className="form-label">Subtype <span>*</span></label>
              <select className="form-select" value={formData.subtype} onChange={e => setFormData({...formData, subtype: e.target.value})}>
                <option value="CUSTOMER_WALLET">Customer Wallet</option>
                <option value="SAVINGS">Savings</option>
                <option value="MERCHANT">Merchant</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border-color/50">
            <button type="button" className="btn btn-secondary" onClick={() => setCreateModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitLoading || !formData.partyId}>{submitLoading ? 'Creating...' : 'Create Account'}</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
