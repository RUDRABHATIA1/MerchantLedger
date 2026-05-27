import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, ArrowLeftRight, DollarSign, Users, CreditCard, Clock, CheckCircle, ShoppingCart, Warehouse } from 'lucide-react';
import Layout from '../components/Layout';
import { LoadingOverlay, Badge, formatCurrency, formatDate, getErrMsg, Amount } from '../components/UI';
import api from '../api/client';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

const chartDefaults = {
  plugins: { legend: { labels: { color: '#8ba3c7', font: { size: 11 } } } },
  scales: {
    x: { ticks: { color: '#4d6b9a' }, grid: { color: '#1e3052' } },
    y: { ticks: { color: '#4d6b9a' }, grid: { color: '#1e3052' } },
  },
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [profitData, setProfitData] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [dashRes, profitRes] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/reports/profit-summary?from=today')
      ]);
      setData(dashRes.data.data);
      setProfitData(profitRes.data.data);
    } catch (err) { setError(getErrMsg(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  if (loading && !data) return <Layout><LoadingOverlay /></Layout>;

  const s = data?.summary || {};

  const statCards = [
    { label: 'Today Deposits',    value: s.todayDeposits?.total || 0,    count: s.todayDeposits?.count || 0,    icon: TrendingUp,    colorClass: 'text-green-primary',  accent: 'bg-green-primary' },
    { label: 'Today Withdrawals', value: s.todayWithdrawals?.total || 0, count: s.todayWithdrawals?.count || 0, icon: TrendingDown,  colorClass: 'text-red-primary',    accent: 'bg-red-primary' },
    { label: 'Today Transfers',   value: s.todayTransfers?.total || 0,   count: s.todayTransfers?.count || 0,   icon: ArrowLeftRight, colorClass: 'text-blue-light',   accent: 'bg-blue-primary' },
    { label: 'Today Fees',        value: s.todayFees?.total || 0,        count: s.todayFees?.count || 0,        icon: DollarSign,    colorClass: 'text-gold',           accent: 'bg-gold' },
    { label: 'Active Accounts',   value: null, count: s.totalAccounts,   icon: CreditCard,    colorClass: 'text-purple-primary', accent: 'bg-purple-primary', raw: true },
    { label: 'Total Parties',     value: null, count: s.totalParties,    icon: Users,         colorClass: 'text-blue-light',     accent: 'bg-blue-light', raw: true },
    { label: 'Posted Txns',       value: null, count: s.totalTransactions, icon: CheckCircle, colorClass: 'text-green-primary',  accent: 'bg-green-primary', raw: true },
    { label: 'Pending Txns',      value: null, count: s.pendingCount,    icon: Clock,         colorClass: 'text-gold',           accent: 'bg-gold', raw: true },
  ];

  // Chart: 7-day volume
  const last7 = data?.last7Days || [];
  const dates = [...new Set(last7.map(d => d._id.date))].sort();
  const getVol = (date, type) => last7.find(d => d._id.date === date && d._id.type === type)?.total || 0;

  const barData = {
    labels: dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      { label: 'Deposits',  data: dates.map(d => getVol(d, 'DEPOSIT')),  backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4 },
      { label: 'Withdrawals', data: dates.map(d => getVol(d, 'WITHDRAWAL')), backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 },
      { label: 'Transfers', data: dates.map(d => getVol(d, 'TRANSFER')), backgroundColor: 'rgba(59,130,246,0.7)', borderRadius: 4 },
    ],
  };

  // Chart: type breakdown donut
  const breakdown = data?.typeBreakdown || [];
  const typeColors = { DEPOSIT: '#10b981', WITHDRAWAL: '#ef4444', TRANSFER: '#3b82f6', FEE: '#f59e0b', REFUND: '#8b5cf6', REVERSAL: '#6b7280' };
  const donutData = {
    labels: breakdown.map(b => b._id),
    datasets: [{ data: breakdown.map(b => b.count), backgroundColor: breakdown.map(b => typeColors[b._id] || '#4d6b9a'), borderWidth: 0, hoverOffset: 6 }],
  };

  return (
    <Layout onRefresh={load}>
      <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-300">
        {error && (
          <div className="px-4 py-3 bg-red-primary/10 border border-red-primary/30 text-red-300 rounded-md text-[0.855rem] mb-4">
            {error}
          </div>
        )}

        {/* Stat Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map(({ label, value, count, icon: Icon, colorClass, accent, raw }) => (
            <div className="card relative overflow-hidden group hover:-translate-y-[1px] p-5" key={label}>
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${accent}`} />
              <div className="text-[0.72rem] text-text-muted uppercase tracking-wider mb-2.5 font-semibold">{label}</div>
              <div className={`text-[1.7rem] font-bold leading-none mb-1.5 ${colorClass}`}>
                {raw ? (count || 0) : formatCurrency(value)}
              </div>
              <div className="text-[0.75rem] text-text-secondary">
                {raw ? 'total records' : `${count || 0} transactions`}
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10 text-5xl">
                <Icon size={48} strokeWidth={1} />
              </div>
            </div>
          ))}
        </div>

        {/* Profit Snapshot Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card p-5 bg-gradient-to-br from-blue-primary/10 to-bg-card border-blue-primary/20">
            <div className="flex justify-between items-start mb-2">
              <div className="text-[0.72rem] text-blue-200 uppercase tracking-wider font-semibold">Today's Trading Profit</div>
              <ShoppingCart size={16} className="text-blue-400" />
            </div>
            <div className={`text-2xl font-bold font-mono ${(profitData?.tradingProfit||0) >= 0 ? 'text-green-300' : 'text-red-400'}`}>
              <Amount value={profitData?.tradingProfit || 0} />
            </div>
          </div>
          {/* Production runs removed — manufacturing expenses card removed */}
          <div className="card p-5 bg-gradient-to-br from-purple-500/20 to-bg-card border-purple-500/30">
            <div className="flex justify-between items-start mb-2">
              <div className="text-[0.72rem] text-purple-200 uppercase tracking-wider font-semibold">Today's Net Profit</div>
              <TrendingUp size={16} className="text-purple-300" />
            </div>
            <div className={`text-2xl font-bold font-mono ${(profitData?.totalProfit||0) >= 0 ? 'text-purple-300' : 'text-red-400'}`}>
              <Amount value={profitData?.totalProfit || 0} />
            </div>
          </div>
          <div className="card p-5 bg-gradient-to-br from-green-primary/10 to-bg-card border-green-primary/20">
            <div className="flex justify-between items-start mb-2">
              <div className="text-[0.72rem] text-green-200 uppercase tracking-wider font-semibold">Godown Stock Value</div>
              <Warehouse size={16} className="text-green-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-green-300">
              <Amount value={profitData?.totalStockValue || 0} />
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 mb-6">
          <div className="card">
            <div className="section-title">7-Day Transaction Volume</div>
            {dates.length > 0
              ? <Bar data={barData} options={{ ...chartDefaults, responsive: true, maintainAspectRatio: true, aspectRatio: 3 }} />
              : <div className="text-center py-8 text-text-muted"><p>No data yet</p></div>}
          </div>
          <div className="card">
            <div className="section-title">Transaction Mix</div>
            {breakdown.length > 0
              ? <Doughnut data={donutData} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#8ba3c7', font: { size: 10 }, padding: 8 } } }, cutout: '65%', maintainAspectRatio: true }} />
              : <div className="text-center py-8 text-text-muted"><p>No data yet</p></div>}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <div className="text-base font-semibold">Recent Transactions</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transactions')}>View all →</button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full border-collapse">
              <thead className="bg-bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Reference</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Posted By</th>
                  <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color whitespace-nowrap">Date</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentTransactions || []).length === 0
                  ? <tr><td colSpan={6} className="text-center p-8 text-text-muted">No transactions yet</td></tr>
                  : (data?.recentTransactions || []).map(tx => (
                    <tr key={tx._id} className="cursor-pointer bg-bg-card hover:bg-bg-card-hover transition-colors" onClick={() => navigate(`/transactions/${tx._id}`)}>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color font-mono">{tx.reference}</td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color"><Badge type={tx.type}>{tx.type}</Badge></td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color"><Badge type={tx.status}>{tx.status}</Badge></td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color"><span className="font-mono font-semibold text-text-primary">{formatCurrency(tx.totalAmount)}</span></td>
                      <td className="px-4 py-3.5 text-[0.855rem] border-b border-border-color text-text-primary">{tx.createdBy?.name || '—'}</td>
                      <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">{formatDate(tx.createdAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
