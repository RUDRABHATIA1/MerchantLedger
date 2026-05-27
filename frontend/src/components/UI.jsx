// Shared UI primitives using Tailwind CSS

export function Spinner({ className = '' }) {
  return <div className={`spinner w-5 h-5 ${className}`} />;
}

export function LoadingOverlay() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="spinner w-8 h-8" />
    </div>
  );
}

export function Badge({ type, children }) {
  const map = {
    POSTED: 'bg-green-primary/15 text-green-light', PENDING: 'bg-yellow-500/15 text-yellow-300', REVERSED: 'bg-purple-primary/15 text-purple-300', FAILED: 'bg-red-primary/15 text-red-300',
    DEPOSIT: 'bg-blue-primary/15 text-blue-300', WITHDRAWAL: 'bg-orange-500/15 text-orange-300', TRANSFER: 'bg-blue-primary/15 text-blue-300',
    FEE: 'bg-gray-500/15 text-gray-400', REFUND: 'bg-purple-primary/15 text-purple-300', REVERSAL: 'bg-red-primary/15 text-red-300',
    ACTIVE: 'bg-green-primary/15 text-green-light', FROZEN: 'bg-yellow-500/15 text-yellow-300', CLOSED: 'bg-gray-500/15 text-gray-400',
    VERIFIED: 'bg-green-primary/15 text-green-light', REJECTED: 'bg-red-primary/15 text-red-300', PENDING_KYC: 'bg-yellow-500/15 text-yellow-300',
    ADMIN: 'bg-purple-primary/15 text-purple-300', TELLER: 'bg-blue-primary/15 text-blue-300', AUDITOR: 'bg-gray-500/15 text-gray-400',
    ASSET: 'bg-blue-primary/15 text-blue-300', LIABILITY: 'bg-yellow-500/15 text-yellow-300', INCOME: 'bg-green-primary/15 text-green-light',
    EXPENSE: 'bg-red-primary/15 text-red-300', EQUITY: 'bg-purple-primary/15 text-purple-300',
    DEBIT: 'bg-red-primary/15 text-red-300', CREDIT: 'bg-green-primary/15 text-green-light',
    INFO: 'bg-blue-primary/15 text-blue-300', WARN: 'bg-yellow-500/15 text-yellow-300', CRITICAL: 'bg-red-primary/15 text-red-300',
    INDIVIDUAL: 'bg-blue-primary/15 text-blue-300', CORPORATE: 'bg-purple-primary/15 text-purple-300',
  };
  return <span className={`badge ${map[type] || 'bg-gray-500/10 text-gray-400'}`}>{children || type}</span>;
}

export function Amount({ value, prefix = '₹', className = '' }) {
  const abs = Math.abs(value || 0);
  const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <span className={`font-mono font-semibold ${className}`}>{prefix}{formatted}</span>;
}

export function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-1.5 justify-center mt-5">
      <button 
        className="w-[34px] h-[34px] rounded-md flex items-center justify-center bg-bg-card border border-border-color text-text-secondary cursor-pointer text-[0.82rem] transition-colors hover:border-border-light hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed" 
        onClick={() => onPage(page - 1)} disabled={page <= 1}>‹</button>
      {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
        const p = i + 1;
        return (
          <button 
            key={p} 
            className={`w-[34px] h-[34px] rounded-md flex items-center justify-center border text-[0.82rem] transition-colors ${p === page ? 'bg-blue-primary border-blue-primary text-white' : 'bg-bg-card border-border-color text-text-secondary hover:border-border-light hover:text-text-primary'}`} 
            onClick={() => onPage(p)}
          >
            {p}
          </button>
        );
      })}
      <button 
        className="w-[34px] h-[34px] rounded-md flex items-center justify-center bg-bg-card border border-border-color text-text-secondary cursor-pointer text-[0.82rem] transition-colors hover:border-border-light hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed" 
        onClick={() => onPage(page + 1)} disabled={page >= pages}>›</button>
    </div>
  );
}

export function EmptyState({ icon = '📂', title = 'No data', sub = '' }) {
  return (
    <div className="text-center py-[60px] px-5 text-text-muted animate-fade-in-up">
      <div className="text-5xl mb-3 opacity-40 animate-float">{icon}</div>
      <h3 className="text-base text-text-secondary mb-1.5 font-medium">{title}</h3>
      {sub && <p className="text-[0.82rem]">{sub}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, size = '' }) {
  if (!open) return null;
  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-5 animate-fade-in transition-all"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`bg-bg-card/95 backdrop-blur-2xl border border-border-light/50 rounded-2xl w-full max-h-[90vh] overflow-y-auto shadow-modal animate-fade-in-up ${size === 'lg' ? 'max-w-[700px]' : 'max-w-[520px]'}`}>
        <div className="px-6 pt-5 pb-4 border-b border-border-color flex items-center justify-between">
          <span className="text-base font-semibold">{title}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, danger }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="p-6">
        <p className="text-text-secondary text-[0.9rem]">{message}</p>
      </div>
      <div className="px-6 py-4 border-t border-border-color flex justify-end gap-2.5">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>Confirm</button>
      </div>
    </Modal>
  );
}

export function Alert({ type = 'info', children }) {
  const styles = {
    error: 'bg-red-primary/10 border-red-primary/30 text-red-300',
    success: 'bg-green-primary/10 border-green-primary/30 text-green-300',
    info: 'bg-blue-primary/10 border-blue-primary/30 text-blue-300',
    warn: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
  };
  return (
    <div className={`px-4 py-3 rounded-md text-[0.855rem] mb-4 border flex gap-2.5 items-start ${styles[type] || styles.info}`}>
      {children}
    </div>
  );
}

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatCurrency(v) {
  return '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getErrMsg(err) {
  return err?.response?.data?.message || err?.message || 'Something went wrong';
}
