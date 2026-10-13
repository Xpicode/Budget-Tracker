import { useEffect } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { seedDefaults } from './repo';
import { runRecurring } from './recurring';
import { startSync } from './sync';
import { useSetting } from './settings';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Accounts from './pages/Accounts';
import Categories from './pages/Categories';
import Recurring from './pages/Recurring';
import Settings from './pages/Settings';
import SyncStatus from './components/SyncStatus';
import UpdateToast from './components/UpdateToast';

export default function App() {
  const theme = useSetting('theme', 'system');

  useEffect(() => {
    seedDefaults().then(runRecurring);
    return startSync();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'system' ? '' : theme;
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="shell">
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/transactions">Transactions</NavLink>
          <NavLink to="/budgets">Budgets</NavLink>
          <NavLink to="/accounts" className="secondary">Accounts</NavLink>
          <NavLink to="/categories" className="secondary">Categories</NavLink>
          <NavLink to="/recurring" className="secondary">Recurring</NavLink>
          <NavLink to="/settings">Settings</NavLink>
          <SyncStatus />
        </nav>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/recurring" element={<Recurring />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <UpdateToast />
      </div>
    </BrowserRouter>
  );
}
