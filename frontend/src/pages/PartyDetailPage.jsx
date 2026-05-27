import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { LoadingOverlay, Badge, Amount, Pagination, EmptyState, formatDate, getErrMsg, Modal } from '../components/UI';
import api from '../api/client';
import { ArrowLeft, User, Building, MapPin, Mail, Phone, Clock, PackageMinus, HandCoins, ShoppingCart, Trash2, Plus } from 'lucide-react';
import ItemAutocomplete from '../components/ItemAutocomplete';

export default function PartyDetailPage() {
  const { id } = useParams();
  const [party, setParty] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [txnModal, setTxnModal] = useState(false);
  const [items, setItems] = useState([{ item: '', quantity: 1, eachCost: '' }]);
  const [txnForm, setTxnForm] = useState({
    type: 'CREDIT_SALE', 
    amount: '',
    direction: 'SOLD',
    description: '',
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (txnForm.type !== 'RECEIVE_PAYMENT') {
      const total = items.reduce((sum, item) => {
        const q = parseFloat(item.quantity) || 0;
        const c = parseFloat(item.eachCost) || 0;
        return sum + (q * c);
      }, 0);
      setTxnForm(prev => ({ ...prev, amount: total > 0 ? total.toFixed(2) : '' }));
    }
  }, [items, txnForm.type]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
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

  const handleRecordTransaction = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const payload = {
        partyId: id,
        amount: parseFloat(txnForm.amount),
      };

      if (txnForm.type === 'CREDIT_SALE') {
        payload.description = compileDescription();
        payload.metadata = { items };
        await api.post('/transactions/credit-sale', payload);
      } else if (txnForm.type === 'RECEIVE_PAYMENT') {
        payload.description = txnForm.description;
        await api.post('/transactions/receive-payment', payload);
      } else {
        payload.direction = txnForm.direction || 'SOLD';
        payload.description = compileDescription();
        payload.metadata = { items };
        await api.post('/transactions/buy-sold', payload);
      }

      setTxnModal(false);
      setTxnForm({ type: 'CREDIT_SALE', amount: '', direction: 'SOLD', description: '' });
      setItems([{ item: '', quantity: 1, eachCost: '' }]);
      load();

    } catch (err) {
      alert(getErrMsg(err));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteEntry = async (txnId) => {
    if (!window.confirm('Delete this transaction? The party\'s balance will be updated automatically.')) return;
    setDeletingId(txnId);
    try {
      await api.delete(`/transactions/${txnId}`);
      load();
    } catch (err) {
      alert(getErrMsg(err));
    } finally {
      setDeletingId(null);
    }
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [partyRes, stmtRes] = await Promise.all([
        api.get(`/parties/${id}`),
        api.get(`/parties/${id}/statement`, { params: { page, limit: 15 } })
      ]);
      setParty(partyRes.data.data);
      setAccounts(partyRes.data.data.accounts || []);
      setEntries(stmtRes.data.data);
      setPages(stmtRes.data.pages);
      setError('');
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  }, [id, page]);

  useEffect(() => { load(); }, [load]);

  if (loading && !party) {
    return <Layout><div className="pt-20"><LoadingOverlay /></div></Layout>;
  }

  if (error && !party) {
    return (
      <Layout>
        <div className="p-8 max-w-[1400px] mx-auto text-center py-20">
          <div className="inline-block p-4 rounded-full bg-red-primary/10 mb-4">
            <User className="w-8 h-8 text-red-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Error Loading Party</h2>
          <p className="text-text-secondary mb-6">{error}</p>
          <Link to="/parties" className="btn btn-primary">Return to Parties</Link>
        </div>
      </Layout>
    );
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.availableBalance || 0), 0);

  return (
    <Layout onRefresh={load}>
      <div className="p-8 max-w-[1400px] mx-auto animate-fade-in-up">
        <Link to="/parties" className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-6 text-sm">
          <ArrowLeft size={16} /> Back to Parties
        </Link>

        {/* Header Profile Card */}
        <div className="card p-8 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-blue-primary/10 flex items-center justify-center text-blue-light border border-blue-primary/20">
              {party.type === 'CORPORATE' ? <Building size={32} /> : <User size={32} />}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-text-primary">{party.name}</h1>
                <Badge type={party.type}>{party.type}</Badge>
                <Badge type={party.kycStatus}>{party.kycStatus}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[0.82rem] text-text-muted mt-2">
                <span className="flex items-center gap-1.5"><Mail size={14} /> {party.email || 'No email'}</span>
                <span className="flex items-center gap-1.5"><Phone size={14} /> {party.phone || 'No phone'}</span>
                <span className="flex items-center gap-1.5"><Clock size={14} /> Joined {new Date(party.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[0.82rem] text-text-muted uppercase tracking-wider font-semibold mb-1">Status</div>
            {totalBalance < 0 ? (
              <div className="text-red-primary font-bold text-2xl">
                Owes You: <Amount value={Math.abs(totalBalance)} className="text-red-primary" />
              </div>
            ) : totalBalance > 0 ? (
              <div className="text-green-primary font-bold text-2xl">
                Advance: <Amount value={totalBalance} className="text-green-primary" />
              </div>
            ) : (
              <div className="text-text-muted font-bold text-2xl">Settled</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Full Width: Consolidated Statement */}
          <div className="card p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Clock size={18} className="text-text-muted" /> Consolidated Transaction History
              </h2>
              <button
                onClick={() => setTxnModal(true)}
                className="relative flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm text-white
                  bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600
                  shadow-[0_0_18px_rgba(99,102,241,0.55)]
                  hover:shadow-[0_0_28px_rgba(99,102,241,0.8)]
                  hover:scale-[1.04] active:scale-[0.98]
                  transition-all duration-200 group"
              >
                {/* pulsing ring */}
                <span className="absolute inset-0 rounded-xl ring-2 ring-indigo-400/60 animate-pulse pointer-events-none" />
                <Plus size={18} className="group-hover:rotate-90 transition-transform duration-200" />
                Record Entry &nbsp;<span className="opacity-80 font-normal text-xs">(Udhar / Jama)</span>
              </button>
            </div>
            
            <div className="overflow-x-auto rounded-xl border border-border-color">
              <table className="w-full border-collapse">
                <thead className="bg-bg-surface">
                  <tr>
                    <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color">Date</th>
                    <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color">Account</th>
                    <th className="px-4 py-3 text-left text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color">Description</th>
                    <th className="px-4 py-3 text-right text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color">Amount</th>
                    <th className="px-4 py-3 text-center text-[0.72rem] font-semibold text-text-muted uppercase tracking-wider border-b border-border-color w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && entries.length === 0 ? (
                    <tr><td colSpan={5} className="p-8"><LoadingOverlay /></td></tr>
                  ) : entries.length === 0 ? (
                    <tr><td colSpan={5}><EmptyState title="No transactions" sub="This party has no recorded transactions" /></td></tr>
                  ) : (
                    entries.map(entry => {
                      const isBuySold = entry.transactionId?.metadata?.shopkeeperTxnType === 'BUY_SOLD';
                      const bsDirection = entry.transactionId?.metadata?.direction; // 'SOLD' or 'BUY'
                      const isSystem = entry.accountId?.isSystemAccount;

                      return (
                        <tr key={entry._id} className="bg-bg-card hover:bg-bg-card-hover transition-colors">
                          <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color whitespace-nowrap">
                            {formatDate(entry.createdAt)}
                          </td>
                          <td className="px-4 py-3.5 text-[0.855rem] text-text-secondary border-b border-border-color">
                            {isSystem ? (
                              <span className="text-text-muted font-semibold text-[0.7rem] uppercase tracking-wider bg-bg-surface px-2 py-0.5 rounded border border-border-color">CASH</span>
                            ) : (
                              <Link to={`/accounts/${entry.accountId?._id}`} className="text-blue-light hover:underline font-mono text-xs">
                                {entry.accountId?.accountNumber}
                              </Link>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-[0.855rem] text-text-primary border-b border-border-color">
                            <div className="font-medium flex items-center gap-2 flex-wrap">
                              <span>{entry.description || entry.transactionId?.description || entry.transactionId?.type}</span>
                              {isBuySold && (
                                <span className={`text-[0.68rem] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  bsDirection === 'SOLD' 
                                    ? 'bg-blue-primary/20 text-blue-light border border-blue-primary/30' 
                                    : 'bg-purple-primary/20 text-purple-light border border-purple-primary/30'
                                }`}>
                                  {bsDirection === 'SOLD' ? 'Cash Sold' : 'Cash Bought'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-text-muted mt-0.5">
                              {entry.transactionId?.reference} • <Badge type={entry.transactionId?.status}>{entry.transactionId?.status}</Badge>
                            </div>
                          </td>
                          <td className={`px-4 py-3.5 text-[0.855rem] font-mono text-right border-b border-border-color ${
                            isBuySold 
                              ? 'text-blue-light font-semibold' 
                              : entry.direction === 'CREDIT' ? 'text-green-light' : 'text-red-light'
                          }`}>
                            {isBuySold 
                              ? (bsDirection === 'SOLD' ? '+₹' : '-₹') 
                              : (entry.direction === 'CREDIT' ? '+' : '-')}
                            <Amount value={entry.amount} prefix="" />
                            {isBuySold && <div className="text-[0.65rem] text-text-muted font-normal mt-0.5">(Instant Cash)</div>}
                          </td>
                          <td className="px-3 py-3.5 border-b border-border-color text-center">
                            <button
                              title="Delete transaction"
                              disabled={deletingId === entry.transactionId?._id}
                              onClick={() => handleDeleteEntry(entry.transactionId?._id)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            <Pagination page={page} pages={pages} onPage={setPage} />
          </div>
        </div>
      </div>
      <Modal open={txnModal} onClose={() => setTxnModal(false)} title={`Record Udhar / Jama / Cash for ${party?.name}`}>
        <div className="overflow-hidden max-w-[800px] w-full mx-auto">
          {/* Top Tabs */}
          <div className="flex border-b border-border-color">
            <button 
              type="button"
              className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 transition-colors ${txnForm.type === 'CREDIT_SALE' ? 'bg-red-primary/10 border-b-2 border-red-primary text-red-100' : 'text-text-muted hover:bg-bg-surface'}`}
              onClick={() => setTxnForm({ ...txnForm, type: 'CREDIT_SALE' })}
            >
              <PackageMinus size={20} className={txnForm.type === 'CREDIT_SALE' ? 'text-red-primary' : ''} />
              <div className="font-bold text-xs">Gave Items (Udhar)</div>
            </button>
            <button 
              type="button"
              className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 transition-colors ${txnForm.type === 'RECEIVE_PAYMENT' ? 'bg-green-primary/10 border-b-2 border-green-primary text-green-100' : 'text-text-muted hover:bg-bg-surface'}`}
              onClick={() => setTxnForm({ ...txnForm, type: 'RECEIVE_PAYMENT' })}
            >
              <HandCoins size={20} className={txnForm.type === 'RECEIVE_PAYMENT' ? 'text-green-primary' : ''} />
              <div className="font-bold text-xs">Received Payment (Jama)</div>
            </button>
            <button 
              type="button"
              className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 transition-colors ${txnForm.type === 'BUY_SOLD' ? 'bg-blue-primary/10 border-b-2 border-blue-primary text-blue-100' : 'text-text-muted hover:bg-bg-surface'}`}
              onClick={() => setTxnForm({ ...txnForm, type: 'BUY_SOLD' })}
            >
              <ShoppingCart size={20} className={txnForm.type === 'BUY_SOLD' ? 'text-blue-light' : ''} />
              <div className="font-bold text-xs">Buy / Sold (Cash)</div>
            </button>
          </div>

          <form onSubmit={handleRecordTransaction} className="p-6">
            {txnForm.type === 'BUY_SOLD' && (
              <div className="form-group mb-4">
                <label className="form-label">Transaction Direction <span>*</span></label>
                <div className="flex gap-4">
                  <label className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border border-border-color bg-bg-base cursor-pointer hover:bg-bg-card-hover transition-colors">
                    <input 
                      type="radio" 
                      name="direction" 
                      value="SOLD" 
                      checked={txnForm.direction === 'SOLD'} 
                      onChange={() => setTxnForm({ ...txnForm, direction: 'SOLD' })}
                      className="text-blue-primary focus:ring-blue-primary"
                    />
                    <div className="font-semibold text-xs">We Sold (Received Cash)</div>
                  </label>
                  <label className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border border-border-color bg-bg-base cursor-pointer hover:bg-bg-card-hover transition-colors">
                    <input 
                      type="radio" 
                      name="direction" 
                      value="BUY" 
                      checked={txnForm.direction === 'BUY'} 
                      onChange={() => setTxnForm({ ...txnForm, direction: 'BUY' })}
                      className="text-blue-primary focus:ring-blue-primary"
                    />
                    <div className="font-semibold text-xs">We Bought (Paid Cash)</div>
                  </label>
                </div>
              </div>
            )}

            {/* Tabular Item List for Udhar & Buy/Sold */}
            {(txnForm.type === 'CREDIT_SALE' || txnForm.type === 'BUY_SOLD') && (
              <div className="mb-4">
                <label className="form-label mb-2">Item Details <span>*</span></label>
                <div className="rounded-xl border border-border-color bg-bg-base overflow-hidden p-3 max-h-[220px] overflow-y-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-text-muted text-[0.68rem] uppercase tracking-wider text-left border-b border-border-color">
                        <th className="pb-1.5 w-[18%] text-center">Qty / Bags</th>
                        <th className="pb-1.5 pl-2">Item Name</th>
                        <th className="pb-1.5 pl-2 w-[22%]">Each Cost (₹)</th>
                        <th className="pb-1.5 text-right w-[20%] pr-2">Total</th>
                        <th className="pb-1.5 w-[8%] text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row, idx) => (
                        <tr key={idx} className="border-b border-border-color/30 last:border-0">
                          <td className="py-2">
                            <input 
                              type="number" 
                              min="0.01" 
                              step="0.01"
                              required
                              placeholder="1"
                              className="form-input text-xs text-center py-1 px-1 font-mono" 
                              value={row.quantity}
                              onChange={e => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || '')}
                            />
                          </td>
                          <td className="py-2 pl-2">
                            <ItemAutocomplete
                              value={row.item}
                              onChange={val => handleItemChange(idx, 'item', val)}
                              placeholder="e.g. Cement bags"
                              className="form-input text-xs py-1 px-2"
                              required
                            />
                          </td>
                          <td className="py-2 pl-2">
                            <input 
                              type="number" 
                              step="0.01" 
                              min="0.01"
                              required
                              placeholder="0.00"
                              className="form-input text-xs py-1 px-2 font-mono" 
                              value={row.eachCost}
                              onChange={e => handleItemChange(idx, 'eachCost', e.target.value)}
                            />
                          </td>
                          <td className="py-2 text-right font-mono text-xs pr-2 text-text-primary">
                            ₹{((parseFloat(row.quantity) || 0) * (parseFloat(row.eachCost) || 0)).toFixed(2)}
                          </td>
                          <td className="py-2 text-center">
                            <button 
                              type="button" 
                              className="p-1 text-text-muted hover:text-red-light transition-colors hover:bg-red-primary/10 rounded-md"
                              onClick={() => removeItemRow(idx)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <button 
                    type="button" 
                    className="btn btn-ghost btn-xs mt-2 flex items-center gap-1 text-blue-light hover:bg-blue-primary/10 font-bold"
                    onClick={addItemRow}
                  >
                    <Plus size={12} /> Add Row
                  </button>
                </div>
              </div>
            )}

            <div className="form-group mb-4">
              <label className="form-label">Total Amount <span>*</span></label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-bold">₹</div>
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  required
                  disabled={txnForm.type !== 'RECEIVE_PAYMENT'}
                  className={`form-input pl-7 text-base font-mono py-2 ${txnForm.type !== 'RECEIVE_PAYMENT' ? 'bg-bg-surface/50 border-dashed cursor-not-allowed' : ''}`}
                  placeholder="0.00"
                  value={txnForm.amount}
                  onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })}
                />
              </div>
            </div>

            {txnForm.type === 'RECEIVE_PAYMENT' && (
              <div className="form-group mb-4">
                <label className="form-label">Details / Description <span className="text-text-muted font-normal">(Optional)</span></label>
                <textarea 
                  rows={2}
                  className="form-input py-2 resize-y text-xs"
                  placeholder="e.g. Paid in Cash, UPI, Google Pay ref: 1234 (leave blank if not needed)"
                  value={txnForm.description}
                  onChange={e => setTxnForm({ ...txnForm, description: e.target.value })}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border-color/50">
              <button type="button" className="btn btn-secondary text-xs" onClick={() => setTxnModal(false)}>Cancel</button>
              <button 
                type="submit" 
                className={`btn text-xs text-white ${
                  txnForm.type === 'CREDIT_SALE' ? 'bg-red-primary hover:bg-red-600 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 
                  txnForm.type === 'RECEIVE_PAYMENT' ? 'bg-green-primary hover:bg-green-600 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 
                  'bg-blue-primary hover:bg-blue-600 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                }`}
                disabled={submitLoading || !txnForm.amount || (txnForm.type !== 'RECEIVE_PAYMENT' && !items.every(i => i.item.trim() !== '' && parseFloat(i.eachCost) > 0))}
              >
                {submitLoading ? 'Saving...' : 
                  txnForm.type === 'CREDIT_SALE' ? 'Record Udhar' : 
                  txnForm.type === 'RECEIVE_PAYMENT' ? 'Record Jama' : 
                  txnForm.direction === 'SOLD' ? 'Record Cash Sale' : 'Record Cash Purchase'}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </Layout>
  );
}
