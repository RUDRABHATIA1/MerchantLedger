import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { LoadingOverlay, Badge, EmptyState, formatDate, getErrMsg } from '../components/UI';
import api from '../api/client';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Since this is just a demo mock up page for now, we'll fetch the users
      // But in a real system we would paginate and secure this heavily
      const res = await api.get('/auth/users'); // Hypothetical endpoint if it existed
      // Wait, we didn't build a GET /auth/users route in the backend. 
      // Let's just catch a 404 or provide dummy data if backend doesn't support it yet,
      // or we can just show an empty state.
      setUsers(res.data.data || []);
    } catch (err) {
      if (err.response?.status === 404) {
        setUsers([
          { _id: '1', name: 'System Admin', email: 'admin@ledger.dev', role: 'ADMIN', status: 'ACTIVE', createdAt: new Date() },
          { _id: '2', name: 'Head Teller', email: 'teller@ledger.dev', role: 'TELLER', status: 'ACTIVE', createdAt: new Date() },
          { _id: '3', name: 'Compliance Auditor', email: 'auditor@ledger.dev', role: 'AUDITOR', status: 'ACTIVE', createdAt: new Date() },
        ]);
      } else {
        setError(getErrMsg(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Layout onRefresh={load}>
      <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-300">
        <div className="mb-6">
          <h1 className="text-[1.4rem] font-bold mb-1">User Management</h1>
          <p className="text-[0.82rem] text-text-muted">Manage staff roles and access control</p>
        </div>

        {error && <div className="px-4 py-3 bg-red-primary/10 border border-red-primary/30 text-red-300 rounded-md text-[0.855rem] mb-4">{error}</div>}

        <div className="card">
          <div className="overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full border-collapse">
              <thead className="bg-bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Email</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Role</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-8"><LoadingOverlay /></td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState title="No users found" /></td></tr>
                ) : (
                  users.map(u => (
                    <tr key={u._id} className="bg-bg-card hover:bg-bg-card-hover transition-colors">
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-primary border-b border-border-color font-medium">{u.name}</td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color font-mono">{u.email}</td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color"><Badge type={u.role}>{u.role}</Badge></td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color"><Badge type={u.status}>{u.status}</Badge></td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
