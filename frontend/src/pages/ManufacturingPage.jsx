import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { Factory, Plus, Trash2, Save, X, Box, Zap, PackageOpen, TrendingUp, Receipt, LineChart } from 'lucide-react';
import { formatCurrency, formatDate, Amount } from '../components/UI';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const PageHeader = ({ title, subtitle, icon: Icon, action }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 px-1">
      <div className="flex items-center gap-3">
      {Icon && <div className="p-2.5 bg-blue-primary/15 rounded-xl text-blue-light shadow-glow"><Icon size={22} /></div>}
      <div>
        <h1 className="text-xl font-bold text-text-primary tracking-tight">{title}</h1>
      </div>
    </div>
    {action && <div>{action}</div>}
  </div>
);

const Card = ({ children, className = '' }) => (
  <div className={`bg-bg-card rounded-2xl border border-border-color/50 overflow-hidden ${className}`}>
    {children}
  </div>
);

export default function ManufacturingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('runs'); // runs, expenses, dashboard
  
  // Data State
  const [runs, setRuns] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [godownItems, setGodownItems] = useState([]);
  
  // Runs Editor State
  const [activeRun, setActiveRun] = useState(null);
  const [isEditingRun, setIsEditingRun] = useState(false);

  // Expenses Editor State
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: '', amount: 0, description: '', expenseMonth: new Date().toISOString().slice(0,7) });
  const [newManualRun, setNewManualRun] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const runsRes = await api.get('/manufacturing/runs');
      setRuns(runsRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load runs: ' + (err.response?.data?.message || err.message));
    }

    try {
      const expRes = await api.get('/manufacturing/expenses');
      setExpenses(expRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load expenses: ' + (err.response?.data?.message || err.message));
    }

    try {
      const recipesRes = await api.get('/manufacturing/recipes');
      setRecipes(recipesRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load recipes: ' + (err.response?.data?.message || err.message));
    }

    try {
      const inventoryRes = await api.get('/items/autocomplete');
      setGodownItems(inventoryRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load inventory items: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // ─── RUNS LOGIC ───────────────────────────────────────────────

  const handleCreateNewRun = () => {
    // Open manual run creator (select recipe + combined quantity). Only this can insert manual runs.
    setActiveRun(null);
    setNewManualRun({ recipeId: '', recipeText: recipes[0]?.name || '', combinedQuantity: 100, notes: '' });
  };

  const createManualRun = async () => {
    if (!newManualRun || (!(newManualRun.recipeId) && !newManualRun.recipeText)) return toast.error('Select or type a recipe');
    if (!newManualRun.combinedQuantity || isNaN(newManualRun.combinedQuantity)) return toast.error('Enter combined quantity');
    try {
      setLoading(true);
      // Resolve to id if possible, otherwise send recipeName
      const match = recipes.find(x => (x.name||'').toLowerCase() === (newManualRun.recipeText||'').toLowerCase());
      const payload = { combinedQuantity: parseFloat(newManualRun.combinedQuantity), notes: newManualRun.notes };
      if (newManualRun.recipeId) payload.recipeId = newManualRun.recipeId;
      else if (match) payload.recipeId = match._id;
      else payload.recipeName = newManualRun.recipeText;

      const res = await api.post('/manufacturing/runs', payload);
      toast.success('Manual run created');
      setNewManualRun(null);
      fetchData();
      return res.data.data;
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create run');
    } finally { setLoading(false); }
  };

  const handleSaveRun = async () => {
    // Editing existing runs via this UI is not supported. Use Manual Run creation which enforces recipe-based runs.
    return toast.error('Editing runs is not supported. Create a new manual run instead.');
  };

  const handleDeleteRun = async (id) => {
    if (!window.confirm('Delete this production run? This will reverse the Godown inventory changes.')) return;
    try {
      // Deleting manufacturing run is implemented by deleting the underlying transaction
      await api.delete(`/transactions/${id}`);
      toast.success('Run deleted & Godown reverted');
      if (activeRun?._id === id) {
        setActiveRun(null);
        setIsEditingRun(false);
      }
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const addRow = (arrayName, defaultRow) => setActiveRun({ ...activeRun, [arrayName]: [...activeRun[arrayName], defaultRow] });
  const updateRow = (arrayName, index, field, value) => {
    const arr = [...activeRun[arrayName]];
    arr[index][field] = value;
    setActiveRun({ ...activeRun, [arrayName]: arr });
  };
  const removeRow = (arrayName, index) => {
    const arr = [...activeRun[arrayName]];
    arr.splice(index, 1);
    setActiveRun({ ...activeRun, [arrayName]: arr });
  };

  const calcRun = useMemo(() => {
    if (!activeRun) return null;
    let totalInputCost = 0;
    activeRun.inputs.forEach(i => { totalInputCost += (parseFloat(i.quantity)||0) * (parseFloat(i.buyingPrice)||0); });
    let totalOverhead = 0;
    activeRun.overheads.forEach(o => { totalOverhead += (parseFloat(o.cost)||0); });
    const totalProcessCost = totalInputCost + totalOverhead;
    return { totalInputCost, totalOverhead, totalProcessCost };
  }, [activeRun]);

  // ─── EXPENSES LOGIC ───────────────────────────────────────────

  const handleSaveExpense = async () => {
    if (!newExpense.category || !newExpense.amount) return toast.error('Category and amount required');
    try {
      await api.post('/manufacturing/expenses', newExpense);
      toast.success('Expense recorded');
      setIsAddingExpense(false);
      setNewExpense({ category: '', amount: 0, description: '', expenseMonth: new Date().toISOString().slice(0,7) });
      fetchData();
    } catch (err) { toast.error('Failed to save expense'); }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.delete(`/manufacturing/expenses/${id}`);
      toast.success('Expense deleted');
      fetchData();
    } catch (err) { toast.error('Failed to delete'); }
  };

  // ─── DASHBOARD LOGIC ──────────────────────────────────────────

  const expenseChartData = useMemo(() => {
    const monthly = {};
    expenses.forEach(e => {
      const m = e.expenseMonth;
      monthly[m] = (monthly[m] || 0) + e.amount;
    });
    const labels = Object.keys(monthly).sort();
    return {
      labels,
      datasets: [{ label: 'Monthly Expenses', data: labels.map(l => monthly[l]), backgroundColor: 'rgba(239, 68, 68, 0.8)' }]
    };
  }, [expenses]);

  return (
    <Layout>
      <PageHeader title="Manufacturing" subtitle="Manage production runs and factory overheads" icon={Factory} />
      <div className="flex justify-end gap-2 mb-3">
        <button className="btn" onClick={() => navigate(-1)}>Back</button>
        <button className="btn btn-ghost" onClick={() => navigate('/manufacturing/inventory')}>Inventory</button>
      </div>
      <div className="flex flex-col gap-6">
        {/* Horizontal Tabs */}
        <div className="w-full flex flex-row gap-2 border-b border-border-color/30 pb-2 overflow-x-auto">
          {[
            { id: 'runs', label: 'Production Runs', icon: PackageOpen },
            { id: 'expenses', label: 'Factory Expenses', icon: Receipt },
            { id: 'dashboard', label: 'Dashboard', icon: LineChart }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-5 py-3 font-semibold text-sm flex items-center gap-2 rounded-xl transition-all whitespace-nowrap ${
                activeTab === t.id 
                  ? 'bg-blue-primary/20 text-blue-light border border-blue-primary/30 shadow-glow' 
                  : 'bg-bg-surface/30 text-text-muted hover:bg-bg-card hover:text-text-primary border border-transparent'
              }`}
            >
              <t.icon size={18} className={activeTab === t.id ? 'text-blue-light' : 'text-text-muted'} /> {t.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center py-10 text-text-muted bg-bg-surface/30 rounded-2xl border border-border-color/30">Loading data...</div>
          ) : (
            <>
              {/* TAB 1: PRODUCTION RUNS */}
              {activeTab === 'runs' && (
                <div className="flex flex-col gap-6">
                  <div className="w-full space-y-4">
                    <div className="flex justify-between items-center mb-2 px-1">
                      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Past Runs</h3>
                      <div className="flex gap-2">
                        <button onClick={() => window.location.href = '/recipes'} className="btn btn-secondary btn-sm flex items-center gap-1"><Zap size={14}/> Auto-Production Rules</button>
                        <button onClick={handleCreateNewRun} className="btn btn-primary btn-sm flex items-center gap-1 shadow-glow"><Plus size={14}/> New Manual Run</button>
                      </div>
                    </div>
                    {newManualRun && (
                      <div className="card p-4 mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="font-semibold">Create Manual Run</div>
                          <div className="flex gap-2">
                            <button className="btn btn-ghost" onClick={() => setNewManualRun(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={createManualRun}>Create Run</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                          <div>
                            <input list="recipes-list" className="form-input" value={newManualRun.recipeText} onChange={e=>{
                              const txt = e.target.value;
                              const match = recipes.find(x => (x.name||'').toLowerCase() === (txt||'').toLowerCase());
                              setNewManualRun({...newManualRun, recipeText: txt, recipeId: match?._id || ''});
                            }} placeholder="Type or select recipe" />
                            <datalist id="recipes-list">{recipes.map(r=> <option key={r._id} value={r.name} />)}</datalist>
                          </div>
                          <input className="form-input" type="number" value={newManualRun.combinedQuantity} onChange={e=>setNewManualRun({...newManualRun, combinedQuantity: e.target.value})} />
                          <input className="form-input" placeholder="Notes (optional)" value={newManualRun.notes} onChange={e=>setNewManualRun({...newManualRun, notes: e.target.value})} />
                        </div>
                        {/* Preview */}
                        {(() => {
                          const r = recipes.find(x => x._id === newManualRun.recipeId) || recipes.find(x => (x.name||'').toLowerCase() === (newManualRun.recipeText||'').toLowerCase());
                          if (!r) return <div className="text-sm text-text-muted">Select or type a recipe to preview required raw materials and outputs (per 100 units combined input)</div>;
                          const per100Inputs = r.inputs.map(i => ({ name: i.name, qtyPer100: +( (i.percent/100) * 100 ).toFixed(4) }));
                          const per100Outputs = r.outputs.map(o => ({ name: o.name, qtyPer100: o.yieldPer100 }));
                          const scale = (parseFloat(newManualRun.combinedQuantity) || 0) / 100;
                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs font-semibold text-text-muted mb-2">Raw Materials (per 100 units combined input)</div>
                                <ul className="list-disc pl-5 text-sm">
                                  {per100Inputs.map(p => <li key={p.name}>{p.name}: {p.qtyPer100} (scaled → {(p.qtyPer100 * scale).toFixed(4)})</li>)}
                                </ul>
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-text-muted mb-2">Finished Outputs (per 100 units combined input)</div>
                                <ul className="list-disc pl-5 text-sm">
                                  {per100Outputs.map(p => <li key={p.name}>{p.name}: {p.qtyPer100} (scaled → {(p.qtyPer100 * scale).toFixed(4)})</li>)}
                                </ul>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {runs.length === 0 ? (
                      <div className="text-center py-8 text-text-muted bg-bg-surface/30 rounded-xl border border-border-color/30">No runs found</div>
                    ) : (
                      <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
                        {runs.map(run => (
                          <div 
                            key={run._id}
                            onClick={() => { setActiveRun(run); setIsEditingRun(false); }}
                            className={`p-4 rounded-xl cursor-pointer transition-all duration-300 border ${
                              activeRun?._id === run._id 
                                ? 'bg-blue-primary/10 border-blue-primary/50 shadow-glow' 
                                : 'bg-bg-surface/50 border-border-color/30 hover:border-blue-primary/30 hover:bg-bg-surface'
                            }`}
                          >
                            <div className="font-semibold text-text-primary mb-1">{run.processName}</div>
                            <div className="flex justify-between items-center text-xs text-text-muted">
                              <span>{formatDate(run.runDate)}</span>
                              <span className="font-mono text-red-300">Cost: {formatCurrency(run.totalProcessCost)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="w-full">
                    {activeRun ? (
                      <Card className="flex flex-col shadow-2xl bg-gradient-to-br from-bg-surface/90 to-bg-surface/50 backdrop-blur-md border border-blue-primary/20">
                        <div className="p-5 border-b border-border-color/50 flex flex-col gap-4 bg-white/5">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Process Name</label>
                              {isEditingRun ? (
                                <input type="text" className="form-input w-full font-bold text-lg mb-2" value={activeRun.processName} onChange={e => setActiveRun({...activeRun, processName: e.target.value})} />
                              ) : (
                                <h2 className="text-xl font-bold text-text-primary mb-2">{activeRun.processName}</h2>
                              )}
                              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Run Date</label>
                              {isEditingRun ? (
                                <input type="date" className="form-input" value={activeRun.runDate ? new Date(activeRun.runDate).toISOString().slice(0, 10) : ''} onChange={e => setActiveRun({...activeRun, runDate: e.target.value})} />
                              ) : (
                                <div className="text-sm text-text-muted">{formatDate(activeRun.runDate)}</div>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {isEditingRun ? (
                                <>
                                  <button onClick={() => { setIsEditingRun(false); fetchData(); }} className="btn btn-ghost"><X size={16} /> Cancel</button>
                                  <button onClick={handleSaveRun} className="btn btn-primary flex items-center gap-2"><Save size={16} /> {activeRun._id ? 'Update' : 'Post to Godown'}</button>
                                </>
                              ) : (
                                <>
                                  {!activeRun.ledgerTransactionId && (
                                    <button onClick={() => setIsEditingRun(true)} className="btn btn-secondary text-blue-light border-blue-primary/30 flex items-center gap-2">Edit</button>
                                  )}
                                  <button onClick={() => handleDeleteRun(activeRun._id)} className="btn btn-danger"><Trash2 size={16} /></button>
                                </>
                              )}
                            </div>
                          </div>
                          {activeRun.ledgerTransactionId && !isEditingRun && (
                            <div className="bg-green-primary/10 border border-green-primary/30 p-2.5 rounded-lg text-xs text-green-300 flex items-center gap-2">
                              <Zap size={14}/> This run is COMPLETED and has permanently updated Godown inventory.
                            </div>
                          )}
                        </div>

                        <div className="p-6 flex-1 space-y-6 overflow-y-auto">
                          {/* Cost Summary */}
                          <div className="bg-bg-card border border-border-color p-4 rounded-xl flex justify-between items-center">
                            <div>
                              <div className="text-xs text-text-muted uppercase font-bold">Total Cost of Production</div>
                              <div className="text-2xl font-mono text-red-300 font-black">{formatCurrency(calcRun?.totalProcessCost)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-text-muted">Raw Materials: {formatCurrency(calcRun?.totalInputCost)}</div>
                              <div className="text-xs text-text-muted">Overheads: {formatCurrency(calcRun?.totalOverheadCost)}</div>
                            </div>
                          </div>

                          {/* Inputs */}
                          <section>
                            <div className="flex justify-between items-end mb-3 border-b border-border-color/50 pb-2">
                              <h3 className="font-bold text-sm text-blue-400 flex items-center gap-2"><Box size={16} /> Raw Materials (Deducted from Godown)</h3>
                              {isEditingRun && <button onClick={() => addRow('inputs', { name: '', quantity: 1, buyingPrice: 0 })} className="btn btn-ghost btn-sm text-blue-light"><Plus size={14} /> Add</button>}
                            </div>
                            <div className="space-y-2">
                              {activeRun.inputs.map((ing, idx) => (
                                <div key={idx} className="bg-bg-card p-3 rounded-lg border border-border-color shadow-sm relative group">
                                  {isEditingRun && <button onClick={() => removeRow('inputs', idx)} className="absolute -top-2 -right-2 bg-red-primary/90 text-white p-1 rounded-full"><X size={12} /></button>}
                                  {isEditingRun ? (
                                    <div className="grid grid-cols-12 gap-2">
                                      <div className="col-span-12 md:col-span-6">
                                        <label className="block text-[0.65rem] uppercase text-text-muted mb-1 font-semibold">Material (From Godown)</label>
                                        <input type="text" list="godown-items" className="form-input w-full text-sm" value={ing.name} onChange={e => updateRow('inputs', idx, 'name', e.target.value)} />
                                        <datalist id="godown-items">{godownItems.map(g => <option key={g} value={g}/>)}</datalist>
                                      </div>
                                      <div className="col-span-6 md:col-span-3">
                                        <label className="block text-[0.65rem] uppercase text-text-muted mb-1 font-semibold">Qty Used</label>
                                        <input type="number" className="form-input w-full text-sm" value={ing.quantity} onChange={e => updateRow('inputs', idx, 'quantity', e.target.value)} />
                                      </div>
                                      <div className="col-span-6 md:col-span-3">
                                        <label className="block text-[0.65rem] uppercase text-text-muted mb-1 font-semibold">Cost/Unit</label>
                                        <input type="number" className="form-input w-full text-sm" value={ing.buyingPrice} onChange={e => updateRow('inputs', idx, 'buyingPrice', e.target.value)} />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex justify-between text-sm w-full">
                                      <div><span className="font-semibold text-text-primary">{ing.name || 'Unnamed'}</span> <span className="text-text-muted ml-2">{ing.quantity} units @ {formatCurrency(ing.buyingPrice)}</span></div>
                                      <div className="font-mono text-red-300">{formatCurrency((ing.quantity||0)*(ing.buyingPrice||0))}</div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </section>

                          {/* Overheads */}
                          <section>
                            <div className="flex justify-between items-end mb-3 border-b border-border-color/50 pb-2">
                              <h3 className="font-bold text-sm text-yellow-400 flex items-center gap-2"><Zap size={16} /> Batch Overheads</h3>
                              {isEditingRun && <button onClick={() => addRow('overheads', { name: '', cost: 0 })} className="btn btn-ghost btn-sm text-yellow-500"><Plus size={14} /> Add</button>}
                            </div>
                            <div className="space-y-2">
                              {activeRun.overheads.map((ov, idx) => (
                                <div key={idx} className="bg-bg-card p-3 rounded-lg border border-border-color shadow-sm relative group">
                                  {isEditingRun && <button onClick={() => removeRow('overheads', idx)} className="absolute -top-2 -right-2 bg-red-primary/90 text-white p-1 rounded-full"><X size={12} /></button>}
                                  {isEditingRun ? (
                                    <div className="grid grid-cols-12 gap-2">
                                      <div className="col-span-12 md:col-span-8">
                                        <input type="text" placeholder="Expense Name" className="form-input w-full text-sm" value={ov.name} onChange={e => updateRow('overheads', idx, 'name', e.target.value)} />
                                      </div>
                                      <div className="col-span-12 md:col-span-4">
                                        <input type="number" placeholder="Cost" className="form-input w-full text-sm" value={ov.cost} onChange={e => updateRow('overheads', idx, 'cost', e.target.value)} />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex justify-between text-sm w-full">
                                      <span className="font-semibold text-text-primary">{ov.name || 'Unnamed'}</span>
                                      <span className="font-mono text-red-300">{formatCurrency(ov.cost)}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </section>

                          {/* Outputs */}
                          <section>
                            <div className="flex justify-between items-end mb-3 border-b border-border-color/50 pb-2">
                              <h3 className="font-bold text-sm text-purple-400 flex items-center gap-2"><PackageOpen size={16} /> Finished Goods (Added to Godown)</h3>
                              {isEditingRun && <button onClick={() => addRow('outputs', { name: '', yieldQty: 1 })} className="btn btn-ghost btn-sm text-purple-400"><Plus size={14} /> Add</button>}
                            </div>
                            <div className="space-y-2">
                              {activeRun.outputs.map((out, idx) => {
                                const totalYield = activeRun.outputs.reduce((s, o) => s + (parseFloat(o.yieldQty)||0), 0);
                                const costShare = totalYield > 0 ? ((parseFloat(out.yieldQty)||0) / totalYield) : 0;
                                const allocatedCost = (calcRun?.totalProcessCost || 0) * costShare;
                                const unitCost = out.yieldQty > 0 ? (allocatedCost / out.yieldQty) : 0;

                                return (
                                  <div key={idx} className="bg-purple-900/10 p-4 rounded-lg border border-purple-500/30 relative shadow-sm">
                                    {isEditingRun && <button onClick={() => removeRow('outputs', idx)} className="absolute -top-2 -right-2 bg-red-primary/90 text-white p-1 rounded-full"><X size={12} /></button>}
                                    {isEditingRun ? (
                                      <div className="grid grid-cols-12 gap-3">
                                        <div className="col-span-12 md:col-span-8">
                                          <label className="block text-[0.65rem] uppercase text-text-muted mb-1 font-semibold">Finished Product</label>
                                          <input type="text" className="form-input w-full text-purple-200 font-bold bg-black/20" value={out.name} onChange={e => updateRow('outputs', idx, 'name', e.target.value)} />
                                        </div>
                                        <div className="col-span-12 md:col-span-4">
                                          <label className="block text-[0.65rem] uppercase text-text-muted mb-1 font-semibold">Yield Qty</label>
                                          <input type="number" className="form-input w-full" value={out.yieldQty} onChange={e => updateRow('outputs', idx, 'yieldQty', e.target.value)} />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex justify-between items-center w-full">
                                        <div>
                                          <div className="font-bold text-base text-purple-200">{out.name || 'Unnamed Product'}</div>
                                          <div className="text-sm text-text-muted mt-0.5">Yield: {out.yieldQty} units</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-xs text-text-muted uppercase">Godown Unit Cost</div>
                                          <div className="font-mono font-bold text-lg text-emerald-300">{formatCurrency(unitCost)}</div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        </div>
                      </Card>
                    ) : (
                      <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-text-muted border-2 border-dashed border-border-color/50 rounded-2xl bg-bg-surface/30">
                        <Factory size={48} className="text-blue-light/50 mb-4" />
                        <p>Select a run or create a new one to log production.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: EXPENSES */}
              {activeTab === 'expenses' && (
                <div className="max-w-4xl">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-text-primary">Monthly Factory Overheads</h2>
                      <p className="text-sm text-text-muted">Log recurring factory expenses like rent, electricity, and fixed wages.</p>
                    </div>
                    {!isAddingExpense && (
                      <button onClick={() => setIsAddingExpense(true)} className="btn btn-primary flex items-center gap-2"><Plus size={16}/> Record Expense</button>
                    )}
                  </div>

                  {isAddingExpense && (
                    <div className="card p-5 mb-6 border-blue-primary/30 bg-blue-primary/5">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="md:col-span-1">
                          <label className="block text-xs uppercase text-text-muted mb-1 font-semibold">Month</label>
                          <input type="month" className="form-input w-full" value={newExpense.expenseMonth} onChange={e => setNewExpense({...newExpense, expenseMonth: e.target.value})} />
                        </div>
                        <div className="md:col-span-1">
                          <label className="block text-xs uppercase text-text-muted mb-1 font-semibold">Category</label>
                          <select className="form-input w-full" value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})}>
                            <option value="">Select...</option>
                            <option value="Electricity">Electricity</option>
                            <option value="Rent">Rent</option>
                            <option value="Wages">Wages</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div className="md:col-span-1">
                          <label className="block text-xs uppercase text-text-muted mb-1 font-semibold">Amount</label>
                          <input type="number" className="form-input w-full font-mono text-red-300" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
                        </div>
                        <div className="md:col-span-1">
                          <label className="block text-xs uppercase text-text-muted mb-1 font-semibold">Notes</label>
                          <input type="text" className="form-input w-full" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setIsAddingExpense(false)} className="btn btn-ghost"><X size={16}/> Cancel</button>
                        <button onClick={handleSaveExpense} className="btn btn-primary"><Save size={16}/> Save</button>
                      </div>
                    </div>
                  )}

                  <div className="card overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-bg-surface border-b border-border-color">
                        <tr>
                          <th className="p-4 text-xs font-semibold text-text-muted uppercase">Month</th>
                          <th className="p-4 text-xs font-semibold text-text-muted uppercase">Category</th>
                          <th className="p-4 text-xs font-semibold text-text-muted uppercase">Notes</th>
                          <th className="p-4 text-xs font-semibold text-text-muted uppercase text-right">Amount</th>
                          <th className="p-4 w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-color/50">
                        {expenses.length === 0 ? (
                          <tr><td colSpan={5} className="p-8 text-center text-text-muted">No expenses recorded.</td></tr>
                        ) : (
                          expenses.map(e => (
                            <tr key={e._id} className="hover:bg-bg-surface/50">
                              <td className="p-4 text-sm">{e.expenseMonth}</td>
                              <td className="p-4 text-sm font-semibold">{e.category}</td>
                              <td className="p-4 text-sm text-text-muted">{e.description}</td>
                              <td className="p-4 text-sm font-mono text-right text-red-300 font-bold">{formatCurrency(e.amount)}</td>
                              <td className="p-4 text-right">
                                <button onClick={() => handleDeleteExpense(e._id)} className="text-text-muted hover:text-red-light transition-colors"><Trash2 size={16}/></button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="max-w-5xl space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="card p-6 border-red-500/20 bg-gradient-to-br from-red-500/5 to-bg-card">
                      <div className="text-xs uppercase text-text-muted font-bold mb-1">Total Factory Expenses (All Time)</div>
                      <div className="text-3xl font-black font-mono text-red-400">
                        <Amount value={expenses.reduce((s, e) => s + e.amount, 0)} />
                      </div>
                    </div>
                    <div className="card p-6 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-bg-card">
                      <div className="text-xs uppercase text-text-muted font-bold mb-1">Total Process Cost (All Runs)</div>
                      <div className="text-3xl font-black font-mono text-blue-400">
                        <Amount value={runs.reduce((s, r) => s + r.totalProcessCost, 0)} />
                      </div>
                    </div>
                    <div className="card p-6 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-bg-card">
                      <div className="text-xs uppercase text-text-muted font-bold mb-1">Production Runs Recorded</div>
                      <div className="text-3xl font-black font-mono text-purple-400">{runs.length}</div>
                    </div>
                  </div>

                  <div className="card p-6 h-[400px]">
                    <h3 className="text-lg font-bold text-text-primary mb-4">Monthly Expenses Breakdown</h3>
                    <div className="h-[300px]">
                      {expenses.length > 0 ? (
                        <Bar data={expenseChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                      ) : (
                        <div className="flex h-full items-center justify-center text-text-muted">No expense data available</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
