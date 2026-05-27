import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import api from '../api/client';
import Layout from '../components/Layout';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

export default function ManufacturingInventory(){
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState([]);
  const [itemsReport, setItemsReport] = useState([]);
  const [manTxns, setManTxns] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const load = async ()=>{
    try{
      const [rRes, itemsRes, manRes, eRes] = await Promise.all([
        api.get('/manufacturing/recipes'),
        api.get('/items/report'),
        api.get('/transactions?type=MANUFACTURING&limit=1000'),
        api.get('/manufacturing/expenses')
      ]);
      setRecipes(rRes.data.data || []);
      setItemsReport(itemsRes.data.data || []);
      setManTxns(manRes.data.data || []);
      setExpenses(eRes.data.data || []);
    }catch(e){ console.error('load inventory', e); }
  };

  useEffect(()=>{ load(); },[]);

  const outputNames = useMemo(()=>{
    const set = new Set();
    recipes.forEach(r=> r.outputs.forEach(o=> set.add((o.name||'').trim().toLowerCase())));
    return Array.from(set);
  }, [recipes]);

  const inventoryRows = useMemo(()=>{
    if (!itemsReport || !itemsReport.length) return [];
    return itemsReport
      .filter(i => outputNames.includes((i.name||'').trim().toLowerCase()))
      .map(i => ({ name: i.name, qtyLeft: i.qtyLeft || 0, avgCost: i.avgPurchaseCost || 0, profit: i.profit || 0 }));
  }, [itemsReport, outputNames]);

  // Monthly production vs expenses (last 6 months)
  const months = useMemo(()=>{
    const arr = [];
    const now = new Date();
    for (let i=5;i>=0;i--){ const d = new Date(now.getFullYear(), now.getMonth()-i, 1); arr.push(d.toISOString().slice(0,7)); }
    return arr;
  },[]);

  const productionByMonth = useMemo(()=>{
    const map = Object.fromEntries(months.map(m=>[m,0]));
    manTxns.forEach(t=>{
      const mon = (new Date(t.createdAt)).toISOString().slice(0,7);
      if (!map[mon]) return;
      const items = t.metadata?.items || [];
      items.forEach(it => { if (it.direction === 'PRODUCED') map[mon] += parseFloat(it.quantity) || 0; });
    });
    return months.map(m=>+map[m].toFixed(2));
  }, [manTxns, months]);

  const expensesByMonth = useMemo(()=>{
    const map = Object.fromEntries(months.map(m=>[m,0]));
    expenses.forEach(e=>{ if (map[e.expenseMonth] !== undefined) map[e.expenseMonth] += e.amount || 0; });
    return months.map(m=>+map[m].toFixed(2));
  }, [expenses, months]);

  const barData = {
    labels: months.map(m => m),
    datasets: [
      { label: 'Produced Qty', data: productionByMonth, backgroundColor: 'rgba(59,130,246,0.8)', borderRadius: 6 },
      { label: 'Overheads ($)', data: expensesByMonth, backgroundColor: 'rgba(239,68,68,0.8)', borderRadius: 6 }
    ]
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Manufacturing Inventory</h2>
            <div className="text-sm text-text-muted">Produced goods, stock left and monthly overheads</div>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => navigate('/manufacturing')}>Back to Manufacturing</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="card lg:col-span-2">
            <div className="section-title">Production vs Overheads (last 6 months)</div>
            <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false, plugins:{ legend:{ position:'bottom' } } }} />
          </div>
          <div className="card">
            <div className="section-title">Quick Stats</div>
            <div className="space-y-2">
              <div className="flex justify-between"><div>Recipes</div><div>{recipes.length}</div></div>
              <div className="flex justify-between"><div>Produced txns</div><div>{manTxns.length}</div></div>
              <div className="flex justify-between"><div>Months shown</div><div>{months.length}</div></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Inventory (Produced goods)</div>
          <div className="overflow-x-auto mt-4">
            <table className="w-full border-collapse">
              <thead className="bg-bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-sm text-text-muted">Name</th>
                  <th className="px-4 py-3 text-right text-sm text-text-muted">Qty Left</th>
                  <th className="px-4 py-3 text-right text-sm text-text-muted">Avg Cost</th>
                  <th className="px-4 py-3 text-right text-sm text-text-muted">Profit</th>
                </tr>
              </thead>
              <tbody>
                {inventoryRows.length === 0 ? (
                  <tr><td colSpan={4} className="p-6 text-center text-text-muted">No manufactured items found</td></tr>
                ) : inventoryRows.map(r => (
                  <tr key={r.name} className="hover:bg-bg-card cursor-default">
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3 text-right">{r.qtyLeft}</td>
                    <td className="px-4 py-3 text-right">${r.avgCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">${r.profit?.toFixed(2) || '0.00'}</td>
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
