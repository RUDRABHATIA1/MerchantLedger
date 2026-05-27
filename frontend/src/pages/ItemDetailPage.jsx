import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { LoadingOverlay, Amount, EmptyState, getErrMsg } from '../components/UI';
import api from '../api/client';
import { ArrowLeft, Package, TrendingUp, Coins, AlertTriangle, Users } from 'lucide-react';

export default function ItemDetailPage() {
  const { itemName } = useParams();
  const [partiesData, setPartiesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const decodedName = decodeURIComponent(itemName);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/items/report/${encodeURIComponent(decodedName)}`);
      if (res.data?.success) {
        setPartiesData(res.data.data || []);
      }
      setError('');
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  }, [decodedName]);

  useEffect(() => {
    load();
  }, [load]);

  const totalQtyBought = partiesData.reduce((sum, p) => sum + p.qtyBought, 0);
  const totalQtySold = partiesData.reduce((sum, p) => sum + p.qtySold, 0);
  const qtyLeft = totalQtyBought - totalQtySold;
  const totalSales = partiesData.reduce((sum, p) => sum + p.amountSold, 0);
  const totalProfit = partiesData.reduce((sum, p) => sum + p.profit, 0);
  const totalParties = partiesData.length;

  return (
    <Layout onRefresh={load}>
      <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-300">
        
        <Link to="/items" className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-6 text-sm">
          <ArrowLeft size={16} /> Back to Inventory
        </Link>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
             <div className="w-14 h-14 rounded-xl bg-blue-primary/10 flex items-center justify-center text-blue-light border border-blue-primary/20">
              <Package size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary tracking-tight capitalize">{decodedName}</h1>
              <p className="text-sm text-text-muted mt-1">Item detail breakdown by associated parties.</p>
            </div>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
           <div className="card p-6 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <Users size={18} className="text-text-muted" />
              <div className="text-xs text-text-muted uppercase font-semibold tracking-wider">Parties Involved</div>
            </div>
            <div className="text-2xl font-bold text-text-primary font-mono">{totalParties}</div>
          </div>

          <div className="card p-6 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <Package size={18} className="text-blue-light" />
              <div className="text-xs text-text-muted uppercase font-semibold tracking-wider">Current Stock</div>
            </div>
            <div className={`text-2xl font-bold font-mono ${qtyLeft < 0 ? 'text-red-light' : 'text-blue-light'}`}>
              {qtyLeft}
            </div>
          </div>

          <div className="card p-6 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <Coins size={18} className="text-green-light" />
              <div className="text-xs text-text-muted uppercase font-semibold tracking-wider">Total Sales Revenue</div>
            </div>
            <div className="text-2xl font-bold text-green-light font-mono">
              <Amount value={totalSales} />
            </div>
          </div>

          <div className="card p-6 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp size={18} className="text-purple-light" />
              <div className="text-xs text-text-muted uppercase font-semibold tracking-wider">Estimated Profit</div>
            </div>
            <div className={`text-2xl font-bold font-mono ${totalProfit >= 0 ? 'text-purple-light' : 'text-red-light'}`}>
              <Amount value={totalProfit} />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-primary/10 border border-red-primary/20 text-red-300 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Parties Table */}
        <div className="card overflow-hidden">
          <div className="px-6 py-5 border-b border-border-color bg-bg-surface flex justify-between items-center">
             <h2 className="text-base font-bold text-text-primary">Associated Parties</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-bg-surface">
                <tr className="border-b border-border-color">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Party Name</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">Qty Bought</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">Qty Sold</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Avg Cost</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Sales Revenue</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/30">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <LoadingOverlay />
                    </td>
                  </tr>
                ) : partiesData.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState 
                        icon="👥" 
                        title="No associated parties" 
                        sub="There are no transactions for this item yet." 
                      />
                    </td>
                  </tr>
                ) : (
                  partiesData.map((party, idx) => (
                    <tr key={idx} className="hover:bg-bg-card-hover transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-text-primary">
                        <Link to={`/parties/${party.partyId}`} className="text-blue-light hover:underline flex items-center gap-2">
                           {party.partyName}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-text-secondary font-mono">
                        {party.qtyBought}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-text-secondary font-mono">
                        {party.qtySold}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-mono text-text-secondary">
                        {party.hasPurchases ? (
                          <Amount value={party.avgPurchaseCost} />
                        ) : (
                          <span className="text-xs text-text-muted italic flex items-center justify-end gap-1">
                            <AlertTriangle size={12} className="text-yellow-500" />
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-mono text-text-secondary">
                        <Amount value={party.amountSold} />
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-mono font-bold">
                        <span className={party.profit >= 0 ? 'text-green-light' : 'text-red-light'}>
                          <Amount value={party.profit} />
                        </span>
                      </td>
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
