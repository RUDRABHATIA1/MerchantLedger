import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import TransactionDetailPage from './pages/TransactionDetailPage';
import PostTransactionPage from './pages/PostTransactionPage';
import AccountsPage from './pages/AccountsPage';
import AccountDetailPage from './pages/AccountDetailPage';
import PartiesPage from './pages/PartiesPage';
import PartyDetailPage from './pages/PartyDetailPage';
import ReportsPage from './pages/ReportsPage';
import AuditLogPage from './pages/AuditLogPage';
import UsersPage from './pages/UsersPage';
import ItemsPage from './pages/ItemsPage';
import ItemDetailPage from './pages/ItemDetailPage';
import ProfitSummaryPage from './pages/ProfitSummaryPage';
import ManufacturingPage from './pages/ManufacturingPage';
import ManufacturingInventory from './pages/ManufacturingInventory';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          
          <Route path="/transactions" element={<PrivateRoute><TransactionsPage /></PrivateRoute>} />
          <Route path="/transactions/:id" element={<PrivateRoute><TransactionDetailPage /></PrivateRoute>} />
          
          <Route path="/post" element={<PrivateRoute><PostTransactionPage /></PrivateRoute>} />
          
          <Route path="/accounts" element={<PrivateRoute><AccountsPage /></PrivateRoute>} />
          <Route path="/accounts/:id" element={<PrivateRoute><AccountDetailPage /></PrivateRoute>} />
          
          <Route path="/parties" element={<PrivateRoute><PartiesPage /></PrivateRoute>} />
          <Route path="/parties/:id" element={<PrivateRoute><PartyDetailPage /></PrivateRoute>} />
          
          <Route path="/items" element={<PrivateRoute><ItemsPage /></PrivateRoute>} />
          <Route path="/items/:itemName" element={<PrivateRoute><ItemDetailPage /></PrivateRoute>} />
          
          <Route path="/profit" element={<PrivateRoute><ProfitSummaryPage /></PrivateRoute>} />
          <Route path="/manufacturing" element={<PrivateRoute><ManufacturingPage /></PrivateRoute>} />
          <Route path="/manufacturing/inventory" element={<PrivateRoute><ManufacturingInventory /></PrivateRoute>} />
          
          <Route path="/reports" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
          
          <Route path="/audit-log" element={<PrivateRoute><AuditLogPage /></PrivateRoute>} />
          
          <Route path="/users" element={<PrivateRoute roles={['ADMIN']}><UsersPage /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
      
      <Toaster 
        position="top-right" 
        toastOptions={{ 
          style: { background: '#111e35', color: '#f0f6ff', border: '1px solid #1e3052' },
          success: { iconTheme: { primary: '#10b981', secondary: '#111e35' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#111e35' } },
        }} 
      />
    </AuthProvider>
  );
}
