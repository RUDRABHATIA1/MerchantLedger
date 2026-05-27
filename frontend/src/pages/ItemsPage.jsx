import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { LoadingOverlay, Amount, EmptyState, getErrMsg } from '../components/UI';
import api from '../api/client';
import { Search, Package, TrendingUp, Coins, AlertTriangle } from 'lucide-react';

export default function ItemsPage() {
  const navigate = useNavigate();
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/items/report');
      if (res.data?.success) {
        setReport(res.data.data || []);
      }
      setError('');
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Filter report locally based on search query
  const filteredReport = report.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  // Quick statistics aggregations
  const totalItems = report.length;
  const totalProfit = report.reduce((sum, item) => sum + (item.profit || 0), 0);
  const totalSales = report.reduce((sum, item) => sum + (item.amountSold || 0), 0);

  return (
    <Layout onRefresh={load}>
      <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-300">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Inventory & Profit Report</h1>
            <p className="text-sm text-text-muted mt-1">Real-time valuation, remaining quantities, and sales profit analytics.</p>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-blue-primary/10 flex items-center justify-center text-blue-light border border-blue-primary/20">
              <Package size={24} />
            </div>
            <div>
              <div className="text-xs text-text-muted uppercase font-semibold tracking-wider">Unique Items</div>
              <div className="text-2xl font-bold text-text-primary mt-1 font-mono">{totalItems}</div>
            </div>
          </div>

          <div className="card p-6 flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-green-primary/10 flex items-center justify-center text-green-light border border-green-primary/20">
              <Coins size={24} />
            </div>
            <div>
              <div className="text-xs text-text-muted uppercase font-semibold tracking-wider">Total Sales Revenue</div>
              <div className="text-2xl font-bold text-green-light mt-1">
                <Amount value={totalSales} />
              </div>
            </div>
          </div>

          {/* Production runs removed — manufacturing profit card removed */}
        </div>

        {/* Production runs removed — manufacturing summary removed */}

        {/* Search Bar */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-11 py-2 text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-primary/10 border border-red-primary/20 text-red-300 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Main Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-bg-surface">
                <tr className="border-b border-border-color">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Item Name</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">Qty Bought</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">Qty Sold</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">Qty Left</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Avg Purchase Cost</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Sales Revenue</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/30">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12">
                      <LoadingOverlay />
                    </td>
                  </tr>
                ) : filteredReport.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState 
                        icon="📦" 
                        title={search ? "No matching items" : "No itemized transactions"} 
                        sub={search ? "Try searching for a different item name" : "Transactions with item details will appear here"} 
                      />
                    </td>
                  </tr>
                ) : (
                  filteredReport.map((item, idx) => {
                    const isNegativeStock = item.qtyLeft < 0;
                    
                    return (
                      <tr 
                        key={idx} 
                        onClick={() => navigate(`/items/${encodeURIComponent(item.name)}`)}
                        className="hover:bg-bg-card-hover transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4 text-sm font-semibold text-text-primary group-hover:text-blue-light transition-colors">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-center text-text-secondary font-mono">
                          {item.qtyBought}
                        </td>
                        <td className="px-6 py-4 text-sm text-center text-text-secondary font-mono">
                          {item.qtySold}
                        </td>
                        <td className="px-6 py-4 text-sm text-center font-mono">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            isNegativeStock 
                              ? 'bg-red-primary/10 text-red-light border border-red-primary/20' 
                              : 'bg-green-primary/10 text-green-light border border-green-primary/20'
                          }`}>
                            {item.qtyLeft}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-mono text-text-secondary">
                          {item.hasPurchases ? (
                            <Amount value={item.avgPurchaseCost} />
                          ) : (
                            <span className="text-xs text-text-muted italic flex items-center justify-end gap-1">
                              <AlertTriangle size={12} className="text-yellow-500" /> No cost details
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-mono text-text-secondary">
                          <Amount value={item.amountSold} />
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-mono font-bold">
                          <span className={item.profit >= 0 ? 'text-green-light' : 'text-red-light'}>
                            <Amount value={item.profit} />
                          </span>
                          {!item.hasPurchases && item.qtySold > 0 && (
                            <div className="text-[0.62rem] text-yellow-500 font-normal mt-0.5">
                              (COGS = 0)
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </Layout>
  );
}
