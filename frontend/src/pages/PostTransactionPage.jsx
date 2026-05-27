import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { getErrMsg } from '../components/UI';
import api from '../api/client';
import toast from 'react-hot-toast';
import ItemAutocomplete from '../components/ItemAutocomplete';
import { PackageMinus, HandCoins, ShoppingCart, Trash2, Plus, ArrowLeftRight } from 'lucide-react';

export default function PostTransactionPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [parties, setParties] = useState([]);
  const [itemReports, setItemReports] = useState([]);
  const [items, setItems] = useState([{ item: '', quantity: 1, eachCost: '' }]);
  
  const [form, setForm] = useState({
    type: 'CREDIT_SALE', // CREDIT_SALE, RECEIVE_PAYMENT, or BUY_SOLD
    partyId: '',
    amount: '',
    direction: 'SOLD', // SOLD (We Sell) or BUY (We Buy)
    description: '',
  });

  useEffect(() => {
    // Load all parties for the dropdown
    api.get('/parties', { params: { limit: 100 } })
      .then(res => setParties(res.data.data))
      .catch(console.error);

    // Load inventory cost basis so manufacturing output cost is visible while trading
    api.get('/items/report')
      .then(res => {
        if (res.data?.success) setItemReports(res.data.data || []);
      })
      .catch(console.error);
  }, []);

  const getItemCostHint = (name) => {
    const norm = (name || '').trim().toLowerCase();
    if (!norm) return null;
    const report = itemReports.find(r => (r.name || '').trim().toLowerCase() === norm);
    return report ? report.avgPurchaseCost : null;
  };

  // Update amount automatically when item list changes
  useEffect(() => {
    if (form.type !== 'RECEIVE_PAYMENT') {
      const total = items.reduce((sum, item) => {
        const q = parseFloat(item.quantity) || 0;
        const c = parseFloat(item.eachCost) || 0;
        return sum + (q * c);
      }, 0);
      setForm(prev => ({ ...prev, amount: total > 0 ? total.toFixed(2) : '' }));
    }
  }, [items, form.type]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    if (field === 'item') {
      const hint = getItemCostHint(value);
      if (hint !== null && (!newItems[index].eachCost || parseFloat(newItems[index].eachCost) <= 0)) {
        newItems[index].eachCost = hint.toFixed(2);
      }
    }
    setItems(newItems);
  };

  const addItemRow = () => {
    setItems([...items, { item: '', quantity: 1, eachCost: '' }]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) {
      setItems([{ item: '', quantity: 1, eachCost: '' }]);
    } else {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const compileDescription = () => {
    return items
      .filter(i => i.item)
      .map(i => `${i.quantity}x ${i.item} (₹${parseFloat(i.eachCost || 0).toFixed(2)} each)`)
      .join('\n');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.partyId) return;

    setLoading(true);
    try {
      const payload = {
        partyId: form.partyId,
        amount: parseFloat(form.amount),
      };

      if (form.type === 'CREDIT_SALE') {
        payload.description = compileDescription();
        payload.metadata = { items };
        await api.post('/transactions/credit-sale', payload);
        toast.success(`Recorded items given to customer`);
      } else if (form.type === 'RECEIVE_PAYMENT') {
        payload.description = form.description;
        await api.post('/transactions/receive-payment', payload);
        toast.success(`Recorded payment received`);
      } else {
        // BUY_SOLD
        payload.direction = form.direction;
        payload.description = compileDescription();
        payload.metadata = { items };
        await api.post('/transactions/buy-sold', payload);
        toast.success(form.direction === 'SOLD' ? 'Recorded direct cash sale' : 'Recorded direct cash purchase');
      }

      navigate(`/parties/${form.partyId}`);
    } catch (err) {
      toast.error(getErrMsg(err));
      setLoading(false);
    }
  };

  const isValid = (() => {
    if (!form.partyId) return false;
    if (form.type === 'RECEIVE_PAYMENT') {
      return parseFloat(form.amount) > 0 && form.description;
    } else {
      return items.length > 0 && items.every(i => i.item.trim() !== '' && parseFloat(i.eachCost) > 0);
    }
  })();

  return (
    <Layout>
      <div className="p-8 max-w-[900px] mx-auto animate-in fade-in duration-300">
        <div className="mb-8">
          <h1 className="text-[1.4rem] font-bold mb-1">Record Daily Entry</h1>
          <p className="text-[0.82rem] text-text-muted">Maintain your shop's daily Udhar, Jama, and Buy/Sold entries</p>
        </div>

        <div className="card shadow-xl overflow-hidden">
          {/* Top Tabs */}
          <div className="flex border-b border-border-color">
            <button 
              type="button"
              className={`flex-1 py-4 flex flex-col items-center justify-center gap-2 transition-colors ${form.type === 'CREDIT_SALE' ? 'bg-red-primary/10 border-b-2 border-red-primary text-red-100' : 'text-text-muted hover:bg-bg-surface'}`}
              onClick={() => setForm({ ...form, type: 'CREDIT_SALE' })}
            >
              <PackageMinus size={24} className={form.type === 'CREDIT_SALE' ? 'text-red-primary' : ''} />
              <div className="font-bold">Gave Items (Udhar)</div>
              <div className="text-[0.7rem] opacity-70 font-normal">Customer took items on credit</div>
            </button>
            <button 
              type="button"
              className={`flex-1 py-4 flex flex-col items-center justify-center gap-2 transition-colors ${form.type === 'RECEIVE_PAYMENT' ? 'bg-green-primary/10 border-b-2 border-green-primary text-green-100' : 'text-text-muted hover:bg-bg-surface'}`}
              onClick={() => setForm({ ...form, type: 'RECEIVE_PAYMENT' })}
            >
              <HandCoins size={24} className={form.type === 'RECEIVE_PAYMENT' ? 'text-green-primary' : ''} />
              <div className="font-bold">Received Payment (Jama)</div>
              <div className="text-[0.7rem] opacity-70 font-normal">Customer paid you money</div>
            </button>
            <button 
              type="button"
              className={`flex-1 py-4 flex flex-col items-center justify-center gap-2 transition-colors ${form.type === 'BUY_SOLD' ? 'bg-blue-primary/10 border-b-2 border-blue-primary text-blue-100' : 'text-text-muted hover:bg-bg-surface'}`}
              onClick={() => setForm({ ...form, type: 'BUY_SOLD' })}
            >
              <ShoppingCart size={24} className={form.type === 'BUY_SOLD' ? 'text-blue-light' : ''} />
              <div className="font-bold">Buy / Sold (Cash)</div>
              <div className="text-[0.7rem] opacity-70 font-normal">Instant cash transaction</div>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8">
            <div className="form-group mb-6">
              <label className="form-label">Select Party (Customer) <span>*</span></label>
              <select 
                className="form-select py-3 text-base"
                required
                value={form.partyId}
                onChange={e => setForm({ ...form, partyId: e.target.value })}
              >
                <option value="">-- Choose who this is for --</option>
                {parties.map(p => (
                  <option key={p._id} value={p._id}>{p.name} {p.phone ? `(${p.phone})` : ''}</option>
                ))}
              </select>
            </div>

            {form.type === 'BUY_SOLD' && (
              <div className="form-group mb-6">
                <label className="form-label">Transaction Direction <span>*</span></label>
                <div className="flex gap-4">
                  <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border border-border-color bg-bg-base cursor-pointer hover:bg-bg-card-hover transition-colors">
                    <input 
                      type="radio" 
                      name="direction" 
                      value="SOLD" 
                      checked={form.direction === 'SOLD'} 
                      onChange={() => setForm({ ...form, direction: 'SOLD' })}
                      className="text-blue-primary focus:ring-blue-primary"
                    />
                    <div className="font-semibold text-sm">We Sold (Received Cash)</div>
                  </label>
                  <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border border-border-color bg-bg-base cursor-pointer hover:bg-bg-card-hover transition-colors">
                    <input 
                      type="radio" 
                      name="direction" 
                      value="BUY" 
                      checked={form.direction === 'BUY'} 
                      onChange={() => setForm({ ...form, direction: 'BUY' })}
                      className="text-blue-primary focus:ring-blue-primary"
                    />
                    <div className="font-semibold text-sm">We Bought (Paid Cash)</div>
                  </label>
                </div>
              </div>
            )}

            {/* Tabular Item List for Udhar & Buy/Sold */}
            {(form.type === 'CREDIT_SALE' || form.type === 'BUY_SOLD') && (
              <div className="mb-8">
                <label className="form-label mb-3">Item Details <span>*</span></label>
                <div className="rounded-xl border border-border-color bg-bg-base overflow-hidden p-4">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-text-muted text-[0.72rem] uppercase tracking-wider text-left border-b border-border-color">
                        <th className="pb-2 w-[18%] text-center">Qty / Bags</th>
                        <th className="pb-2 pl-3">Item Name</th>
                        <th className="pb-2 pl-3 w-[22%]">Each Cost (₹)</th>
                        <th className="pb-2 text-right w-[20%] pr-2">Total</th>
                        <th className="pb-2 w-[8%] text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row, idx) => (
                        <tr key={idx} className="border-b border-border-color/30 last:border-0">
                          <td className="py-2.5">
                            <input 
                              type="number" 
                              min="0.01" 
                              step="0.01"
                              required
                              placeholder="1"
                              className="form-input text-sm text-center py-1.5 px-2 font-mono" 
                              value={row.quantity}
                              onChange={e => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || '')}
                            />
                          </td>
                          <td className="py-2.5 pl-3">
                            <ItemAutocomplete
                              value={row.item}
                              onChange={val => handleItemChange(idx, 'item', val)}
                              placeholder="e.g. Sugar, Bags of cement"
                              className="form-input text-sm py-1.5 px-3"
                              required
                            />
                            {getItemCostHint(row.item) !== null && (
                              <div className="mt-1 text-[0.65rem] text-text-muted">
                                Current cost basis: ₹{getItemCostHint(row.item).toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 pl-3">
                            <input 
                              type="number" 
                              step="0.01" 
                              min="0.01"
                              required
                              placeholder="0.00"
                              className="form-input text-sm py-1.5 px-3 font-mono" 
                              value={row.eachCost}
                              onChange={e => handleItemChange(idx, 'eachCost', e.target.value)}
                            />
                          </td>
                          <td className="py-2.5 text-right font-mono text-sm pr-2 text-text-primary">
                            ₹{((parseFloat(row.quantity) || 0) * (parseFloat(row.eachCost) || 0)).toFixed(2)}
                          </td>
                          <td className="py-2.5 text-center">
                            <button 
                              type="button" 
                              className="p-1.5 text-text-muted hover:text-red-light transition-colors hover:bg-red-primary/10 rounded-md"
                              onClick={() => removeItemRow(idx)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm mt-3 flex items-center gap-1.5 text-blue-light hover:bg-blue-primary/10 font-bold"
                    onClick={addItemRow}
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>
              </div>
            )}

            <div className="form-group mb-6">
              <label className="form-label">Total Amount <span>*</span></label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold">₹</div>
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  required
                  disabled={form.type !== 'RECEIVE_PAYMENT'}
                  className={`form-input pl-8 text-xl font-mono py-3 ${form.type !== 'RECEIVE_PAYMENT' ? 'bg-bg-surface/50 border-dashed cursor-not-allowed' : ''}`}
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              {(form.type === 'CREDIT_SALE' || form.type === 'BUY_SOLD') && (
                <p className="text-[0.7rem] text-text-muted mt-1.5">Calculated automatically from itemized costs</p>
              )}
            </div>

            {form.type === 'RECEIVE_PAYMENT' && (
              <div className="form-group mb-8">
                <label className="form-label">Details / Description <span>*</span></label>
                <textarea 
                  required
                  rows={4}
                  className="form-input py-3 resize-y"
                  placeholder="e.g. Paid in Cash, UPI, Google Pay ref: 1234"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>
            )}

            <button 
              type="submit" 
              className={`w-full py-4 rounded-xl font-bold text-white transition-all transform active:scale-95 ${
                !isValid ? 'bg-bg-surface text-text-muted cursor-not-allowed' :
                form.type === 'CREDIT_SALE' ? 'bg-red-primary hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 
                form.type === 'RECEIVE_PAYMENT' ? 'bg-green-primary hover:bg-green-600 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 
                'bg-blue-primary hover:bg-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
              }`}
              disabled={!isValid || loading}
            >
              {loading ? 'Saving Entry...' : 
                form.type === 'CREDIT_SALE' ? 'Record Items Given' : 
                form.type === 'RECEIVE_PAYMENT' ? 'Record Payment Received' : 
                form.direction === 'SOLD' ? 'Record Direct Cash Sale' : 'Record Direct Cash Purchase'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
