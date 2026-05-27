import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, CreditCard, ArrowLeftRight,
  FileText, ClipboardList, UserCog, LogOut, Landmark, Package, Calculator, Factory, TrendingUp
} from 'lucide-react';

const navSections = [
  {
    label: 'Operations',
    items: [
      { to: '/',              icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/transactions',  icon: ArrowLeftRight,  label: 'Transactions' },
      { to: '/post',          icon: CreditCard,      label: 'Post Transaction' },
    ],
  },
  {
    label: 'Ledger',
    items: [
      { to: '/accounts', icon: Landmark, label: 'Accounts' },
      { to: '/parties',  icon: Users,    label: 'Parties' },
      { to: '/items',    icon: Package,  label: 'Inventory Log' },
      { to: '/manufacturing', icon: Factory, label: 'Manufacturing' },
      { to: '/profit',   icon: TrendingUp, label: 'Profit Summary' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { to: '/reports',   icon: FileText,     label: 'Reports' },
      { to: '/audit-log', icon: ClipboardList, label: 'Audit Log' },
    ],
  },
];

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 w-sidebar h-screen bg-bg-surface/80 backdrop-blur-xl border-r border-border-color/60 flex flex-col z-[100] overflow-y-auto shadow-xl">
      <div className="flex items-center gap-2.5 p-5 pb-4 border-b border-border-color/60">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-primary to-purple-primary flex items-center justify-center text-lg flex-shrink-0 shadow-glow transition-transform hover:scale-110">
          💳
        </div>
        <div>
          <div className="text-[0.95rem] font-bold text-text-primary">PaymentLedger</div>
          <div className="text-[0.65rem] text-text-muted tracking-[0.08em] uppercase">Core Banking System</div>
        </div>
      </div>

      {navSections.map((section) => (
        <div className="p-3 pb-1" key={section.label}>
          <div className="text-[0.62rem] font-semibold tracking-widest uppercase text-text-muted px-2 pb-1.5">
            {section.label}
          </div>
          {section.items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => 
                `group flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-300 w-full mb-0.5
                ${isActive 
                  ? 'bg-blue-primary/20 text-blue-light border border-blue-primary/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' 
                  : 'text-text-secondary hover:bg-bg-card hover:text-text-primary border border-transparent hover:translate-x-1'}`
              }
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0 transition-colors group-hover:text-blue-light" />
              {label}
            </NavLink>
          ))}
        </div>
      ))}

      {isAdmin && (
        <div className="p-3 pb-1">
          <div className="text-[0.62rem] font-semibold tracking-widest uppercase text-text-muted px-2 pb-1.5">
            Admin
          </div>
          <NavLink
            to="/users"
            className={({ isActive }) => 
              `group flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-300 w-full mb-0.5
              ${isActive 
                ? 'bg-blue-primary/20 text-blue-light border border-blue-primary/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' 
                : 'text-text-secondary hover:bg-bg-card hover:text-text-primary border border-transparent hover:translate-x-1'}`
            }
          >
            <UserCog className="w-[18px] h-[18px] flex-shrink-0 transition-colors group-hover:text-blue-light" />
            Users
          </NavLink>
        </div>
      )}

      <div className="mt-auto p-3 border-t border-border-color">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-primary to-purple-primary flex items-center justify-center text-[0.8rem] font-bold text-white">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-[0.82rem] font-semibold">{user?.name}</div>
            <div className="text-[0.68rem] text-text-muted uppercase tracking-[0.05em]">{user?.role}</div>
          </div>
        </div>
        <button 
          className="btn btn-ghost btn-sm w-full justify-start text-text-secondary hover:text-red-light hover:bg-red-primary/10 transition-colors" 
          onClick={handleLogout}
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
