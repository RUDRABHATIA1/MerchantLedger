import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { LoadingOverlay, Badge, Pagination, EmptyState, formatDate, getErrMsg } from '../components/UI';
import api from '../api/client';
import { Search } from 'lucide-react';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [action, setAction] = useState('');
  const [severity, setSeverity] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/audit-logs', { params: { page, limit: 20, action, severity } });
      setLogs(res.data.data);
      setPages(res.data.pages);
      setError('');
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  }, [page, action, severity]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') { setPage(1); load(); }
  };

  return (
    <Layout onRefresh={load}>
      <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-300">
        <div className="mb-6">
          <h1 className="text-[1.4rem] font-bold mb-1">Audit Log</h1>
          <p className="text-[0.82rem] text-text-muted">Immutable record of all system activities</p>
        </div>

        {error && <div className="px-4 py-3 bg-red-primary/10 border border-red-primary/30 text-red-300 rounded-md text-[0.855rem] mb-4">{error}</div>}

        <div className="card">
          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
              <input
                type="text"
                className="form-input pl-9"
                placeholder="Search by action (e.g., POST_DEPOSIT)..."
                value={action}
                onChange={(e) => setAction(e.target.value)}
                onKeyDown={handleSearch}
              />
            </div>
            <select className="form-select w-auto min-w-[140px]" value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }}>
              <option value="">All Severities</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warning</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full border-collapse">
              <thead className="bg-bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Severity / Action</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Summary</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">User</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-8"><LoadingOverlay /></td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState title="No logs found" /></td></tr>
                ) : (
                  logs.map(log => (
                    <tr key={log._id} className="bg-bg-card hover:bg-bg-card-hover transition-colors">
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-primary border-b border-border-color font-mono">
                        <div className="flex items-center gap-2">
                          <Badge type={log.severity}>{log.severity}</Badge>
                          <span>{log.action}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">{log.summary}</td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-primary border-b border-border-color">
                        {log.userId?.name || log.userName}
                        <div className="text-[0.7rem] text-text-muted mt-0.5">{log.userId?.email || '—'}</div>
                      </td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-muted border-b border-border-color font-mono">{log.ip || '—'}</td>
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
