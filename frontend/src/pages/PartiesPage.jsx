import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { LoadingOverlay, Badge, Pagination, EmptyState, formatDate, getErrMsg, Modal } from '../components/UI';
import api from '../api/client';
import { Search, Plus } from 'lucide-react';

export default function PartiesPage() {
  const navigate = useNavigate();
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', type: 'INDIVIDUAL' });
  const [submitLoading, setSubmitLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/parties', { params: { page, limit: 15, search, type } });
      setParties(res.data.data);
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

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      await api.post('/parties', formData);
      setCreateModal(false);
      setFormData({ name: '', email: '', phone: '', type: 'INDIVIDUAL' });
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
            <h1 className="text-[1.4rem] font-bold mb-1">Parties</h1>
            <p className="text-[0.82rem] text-text-muted">Manage customers and corporate entities</p>
          </div>
          <button className="btn btn-primary" onClick={() => setCreateModal(true)}>
            <Plus size={16} /> New Party
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
                placeholder="Search by name or email (Press Enter)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearch}
              />
            </div>
            <select className="form-select w-auto min-w-[140px]" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="CORPORATE">Corporate</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full border-collapse">
              <thead className="bg-bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Contact</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">KYC Status</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-8"><LoadingOverlay /></td></tr>
                ) : parties.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState title="No parties found" /></td></tr>
                ) : (
                  parties.map(p => (
                    <tr key={p._id} onClick={() => navigate(`/parties/${p._id}`)} className="bg-bg-card hover:bg-bg-card-hover transition-colors cursor-pointer">
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-primary border-b border-border-color font-medium">{p.name}</td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color"><Badge type={p.type}>{p.type}</Badge></td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">
                        <div className="flex flex-col">
                          <span>{p.email || '—'}</span>
                          <span className="text-[0.75rem] text-text-muted">{p.phone}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">
                        <Badge type={p.kycStatus}>{p.kycStatus}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">{formatDate(p.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <Pagination page={page} pages={pages} onPage={setPage} />
        </div>
      </div>

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create New Party">
        <form onSubmit={handleCreate} className="p-6">
          <div className="form-group">
            <label className="form-label">Name <span>*</span></label>
            <input className="form-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Full name or Company name" />
          </div>
          <div className="form-group">
            <label className="form-label">Type <span>*</span></label>
            <select className="form-select" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
              <option value="INDIVIDUAL">Individual</option>
              <option value="CORPORATE">Corporate</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="contact@example.com" />
          </div>
          <div className="form-group mb-6">
            <label className="form-label">Phone</label>
            <input className="form-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+1 555-0100" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border-color/50">
            <button type="button" className="btn btn-secondary" onClick={() => setCreateModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitLoading}>{submitLoading ? 'Creating...' : 'Create Party'}</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
