import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RefreshCw } from 'lucide-react';

const titles = {
  '/':            { title: 'Dashboard',        sub: 'Live ledger overview' },
  '/transactions':{ title: 'Transactions',     sub: 'All journal transactions' },
  '/post':        { title: 'Post Transaction', sub: 'Double-entry posting wizard' },
  '/accounts':    { title: 'Accounts',         sub: 'Chart of accounts & balances' },
  '/parties':     { title: 'Parties',          sub: 'Customers & businesses' },
  '/reports':     { title: 'Reports',          sub: 'Trial balance, reconciliation & analytics' },
  '/audit-log':   { title: 'Audit Log',        sub: 'Immutable compliance trail' },
  '/users':       { title: 'User Management',  sub: 'Roles & access control' },
};

export default function Topbar({ onRefresh }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const base = '/' + pathname.split('/')[1];
  const meta = titles[base] || titles['/'];
  const now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <header className="fixed top-0 left-sidebar right-0 h-topbar bg-bg-base/70 backdrop-blur-xl border-b border-border-color/60 flex items-center px-8 gap-4 z-[90] shadow-sm animate-fade-in">
      <div className="flex-1 animate-slide-in-right">
        <div className="text-[1.1rem] font-semibold">{meta.title}</div>
        <div className="text-[0.78rem] text-text-muted">{meta.sub}</div>
      </div>
      
      <div className="text-[0.78rem] text-text-muted hidden sm:block animate-fade-in">{now}</div>
      
      {onRefresh && (
        <button 
          className="btn btn-ghost btn-icon text-text-secondary hover:text-blue-light hover:bg-blue-primary/10 rounded-full transition-all duration-300 hover:rotate-180 hover:scale-110" 
          onClick={onRefresh} 
          title="Refresh data"
        >
          <RefreshCw size={16} />
        </button>
      )}
      
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-bg-card/80 border border-border-color/80 cursor-pointer hover:border-blue-primary/50 hover:shadow-glow transition-all duration-300 hover:-translate-y-0.5">
        <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-blue-primary to-purple-primary flex items-center justify-center text-[0.75rem] font-bold text-white shadow-sm ring-2 ring-transparent hover:ring-blue-primary/50 transition-all">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div className="hidden sm:block pr-1">
          <div className="text-[0.825rem] font-medium leading-tight">{user?.name}</div>
          <div className="text-[0.68rem] text-text-muted uppercase tracking-[0.05em] leading-tight">{user?.role}</div>
        </div>
      </div>
    </header>
  );
}
