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

const tabs = [
  { to: '/invoices', label: 'Invoices' },
  { to: '/products', label: 'Products' },
  { to: '/customers', label: 'Customers' },
  { to: '/settings', label: 'Settings' },
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
  if (loading) return <div className="p-6 text-center text-gray-500">Loading...</div>;
  if (!session) return <Login />;

  return (
    <div className="mx-auto max-w-3xl min-h-screen pb-20">
      <main className="p-4">
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
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t print:hidden"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto max-w-3xl grid grid-cols-4">
          {tabs.map(t => (
            <NavLink key={t.to} to={t.to}
              className={({ isActive }) =>
                `py-3 text-center text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
