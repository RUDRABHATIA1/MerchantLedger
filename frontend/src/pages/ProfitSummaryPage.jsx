import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { LoadingOverlay, Amount, EmptyState, getErrMsg } from '../components/UI';
import api from '../api/client';
import { TrendingUp, ShoppingCart, Calendar, Warehouse } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function ProfitSummaryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Quick filters for dates
  const [dateRange, setDateRange] = useState('all');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      let query = '';
      if (dateRange === '30days') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        query = `?from=${d.toISOString().slice(0, 10)}`;
      } else if (dateRange === 'today') {
        const d = new Date();
        query = `?from=${d.toISOString().slice(0, 10)}`;
      }
      const res = await api.get(`/reports/profit-summary${query}`);
      if (res.data?.success) {
        setData(res.data.data);
      }
      setError('');
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <Layout><LoadingOverlay /></Layout>;

  // Prepare chart data (trading profit only — manufacturing removed)
  const chartLabels = [];
  const tradingData = [];
  if (data?.dailyTradingProfit) {
    const sorted = (data.dailyTradingProfit || []).map(d => d._id).sort();
    sorted.forEach(d => {
      chartLabels.push(new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      const t = data.dailyTradingProfit.find(x => x._id === d);
      tradingData.push(t ? t.profit : 0);
    });
  }

  const barData = {
    labels: chartLabels,
    datasets: [{ label: 'Trading Profit', data: tradingData, backgroundColor: 'rgba(59,130,246,0.7)', borderRadius: 4 }]
  };

  const chartOpts = {
    responsive: true, 
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#8ba3c7' } } },
    scales: {
      x: { ticks: { color: '#4d6b9a' }, grid: { color: '#1e3052' } },
      y: { ticks: { color: '#4d6b9a' }, grid: { color: '#1e3052' } },
    }
  };

  return (
    <Layout onRefresh={load}>
      <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-300">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Merchant Profit Center</h1>
            <p className="text-sm text-text-muted mt-1">Combined view of trading & manufacturing profits with Godown inventory.</p>
          </div>
          
          <div className="flex items-center gap-2 bg-bg-surface p-1.5 rounded-lg border border-border-color">
            <Calendar size={16} className="text-text-muted ml-2" />
            <select 
              className="bg-transparent text-sm text-text-primary border-none focus:ring-0 outline-none cursor-pointer pr-4"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="30days">Last 30 Days</option>
              <option value="today">Today</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-primary/10 border border-red-primary/20 text-red-300 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Hero Profit Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 flex flex-col justify-between border border-blue-primary/30 bg-gradient-to-br from-blue-primary/10 to-bg-card relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 text-blue-light/10 transform group-hover:scale-110 transition-transform"><ShoppingCart size={120} /></div>
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <div className="p-2 bg-blue-primary/20 rounded-lg text-blue-400"><ShoppingCart size={20} /></div>
              <div className="font-semibold text-text-primary">Trading Profit</div>
            </div>
            <div className={`text-4xl font-black font-mono relative z-10 ${(data?.tradingProfit||0) >= 0 ? 'text-green-300' : 'text-red-400'}`}>
              <Amount value={data?.tradingProfit || 0} />
            </div>
            <div className="text-xs text-text-muted mt-2 relative z-10">Profit from buy/sell transactions</div>
          </div>

          {/* Manufacturing removed — skipping manufacturing expenses card */}

          <div className="card p-6 flex flex-col justify-between border border-purple-500/50 bg-gradient-to-br from-purple-500/20 to-bg-card relative overflow-hidden group shadow-[0_0_20px_rgba(168,85,247,0.15)]">
            <div className="absolute -right-6 -top-6 text-purple-500/10 transform group-hover:scale-110 transition-transform"><TrendingUp size={120} /></div>
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <div className="p-2 bg-purple-500/30 rounded-lg text-purple-300"><TrendingUp size={20} /></div>
              <div className="font-bold text-white text-lg">Net Combined Profit</div>
            </div>
            <div className={`text-4xl font-black font-mono relative z-10 ${(data?.totalProfit||0) >= 0 ? 'text-purple-300 drop-shadow-[0_0_8px_rgba(216,180,254,0.6)]' : 'text-red-400'}`}>
              <Amount value={data?.totalProfit || 0} />
            </div>
            <div className="text-xs text-text-muted mt-2 relative z-10">Total profit across all operations</div>
          </div>
        </div>

        {/* Chart & Godown Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* Chart */}
          <div className="card p-6 flex flex-col h-[400px]">
            <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2"><TrendingUp size={18}/> Daily Profit Trends</h3>
            <div className="flex-1 w-full relative">
              {chartLabels.length > 0 ? (
                <Bar data={barData} options={chartOpts} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-text-muted">No profit data for this period</div>
              )}
            </div>
          </div>

          {/* Godown */}
          <div className="card p-6 flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2"><Warehouse size={18}/> Godown Inventory</h3>
              <div className="text-right">
                <div className="text-xs text-text-muted uppercase">Total Stock Value</div>
                <div className="font-mono font-bold text-green-300"><Amount value={data?.totalStockValue || 0}/></div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto border border-border-color rounded-xl bg-bg-surface/30">
              <table className="w-full text-left border-collapse">
                <thead className="bg-bg-surface sticky top-0 z-10">
                  <tr>
                    <th className="p-3 text-xs font-semibold text-text-muted uppercase">Item</th>
                    <th className="p-3 text-xs font-semibold text-text-muted uppercase text-center">Qty Left</th>
                    <th className="p-3 text-xs font-semibold text-text-muted uppercase text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color/50">
                  {data?.godownItems?.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-text-muted">Godown is empty</td></tr>
                  ) : (
                    (data?.godownItems || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-bg-card transition-colors">
                        <td className="p-3 font-semibold text-sm capitalize">{item.name}</td>
                        <td className="p-3 text-center font-mono text-sm">
                          <span className={`px-2 py-0.5 rounded-full ${item.qtyLeft > 0 ? 'bg-blue-primary/20 text-blue-300' : 'bg-red-primary/20 text-red-300'}`}>
                            {item.qtyLeft}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-sm text-text-secondary"><Amount value={item.stockValue}/></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </Layout>
  );
}
