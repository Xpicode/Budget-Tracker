import { useEffect } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { seedDefaults } from './repo';
import { startSync } from './sync';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Accounts from './pages/Accounts';
import Categories from './pages/Categories';
import Account from './pages/Account';
import SyncStatus from './components/SyncStatus';
import UpdateToast from './components/UpdateToast';

export default function App() {
  useEffect(() => {
    seedDefaults();
    return startSync();
  }, []);

  return (
    <BrowserRouter>
      <div className="shell">
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/transactions">Transactions</NavLink>
          <NavLink to="/budgets">Budgets</NavLink>
          <NavLink to="/accounts">Accounts</NavLink>
          <NavLink to="/categories">Categories</NavLink>
          <NavLink to="/account">Account</NavLink>
          <SyncStatus />
        </nav>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/account" element={<Account />} />
          </Routes>
        </main>
        <UpdateToast />
      </div>
    </BrowserRouter>
  );
}
