import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { configured, supabase } from './lib/supabase';
import Login from './pages/Login';
import Products from './pages/Products';
import ProductForm from './pages/ProductForm';
import Customers from './pages/Customers';
import CustomerForm from './pages/CustomerForm';
import Invoices from './pages/Invoices';
import InvoiceEditor from './pages/InvoiceEditor';
import InvoiceView from './pages/InvoiceView';
import SettingsPage from './pages/Settings';
import EmailTemplates from './pages/EmailTemplates';
import SendEmail from './pages/SendEmail';
import PullToRefresh from './components/PullToRefresh';
import { BoxIcon, GearIcon, InvoiceIcon, PeopleIcon } from './components/icons';

const tabs = [
  { to: '/invoices', label: 'Invoices', Icon: InvoiceIcon },
  { to: '/products', label: 'Products', Icon: BoxIcon },
  { to: '/customers', label: 'Customers', Icon: PeopleIcon },
  { to: '/settings', label: 'Settings', Icon: GearIcon },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!configured) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-xl font-bold mb-2">Not configured</h1>
        <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <img src="apple-touch-icon.png" alt="" className="h-16 w-16 rounded-2xl animate-pulse" />
      </div>
    );
  }
  if (!session) return <Login />;

  return (
    <div className="mx-auto max-w-3xl min-h-screen">
      <PullToRefresh />
      <main className="px-4" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/invoices" replace />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/new" element={<InvoiceEditor />} />
          <Route path="/invoices/:id" element={<InvoiceView />} />
          <Route path="/invoices/:id/edit" element={<InvoiceEditor />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/new" element={<ProductForm />} />
          <Route path="/products/:id" element={<ProductForm />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/new" element={<CustomerForm />} />
          <Route path="/customers/:id" element={<CustomerForm />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/templates" element={<EmailTemplates />} />
          <Route path="/invoices/:id/email" element={<SendEmail />} />
          <Route path="*" element={<Navigate to="/invoices" replace />} />
        </Routes>
      </main>
      <nav className="ios-bar fixed bottom-0 inset-x-0 z-30 border-t border-black/10 print:hidden"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto max-w-3xl grid grid-cols-4">
          {tabs.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 pt-2 pb-1 text-[10px] font-medium ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
              <Icon className="h-6 w-6" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
