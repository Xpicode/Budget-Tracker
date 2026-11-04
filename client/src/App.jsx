import { useEffect } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { seedDefaults } from './repo';
import { runRecurring } from './recurring';
import { startSync } from './sync';
import { useTheme } from './settings';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Accounts from './pages/Accounts';
import Categories from './pages/Categories';
import Recurring from './pages/Recurring';
import Settings from './pages/Settings';
import SyncStatus from './components/SyncStatus';
import UpdateToast from './components/UpdateToast';
import Icon from './components/Icon';

// secondary: shown in the desktop sidebar only; on phones they live under Settings → Manage.
const LINKS = [
  { to: '/', icon: 'home', label: 'Dashboard' },
  { to: '/transactions', icon: 'list', label: 'Transactions' },
  { to: '/budgets', icon: 'budget', label: 'Budgets' },
  { to: '/accounts', icon: 'wallet', label: 'Accounts', secondary: true },
  { to: '/categories', icon: 'tag', label: 'Categories', secondary: true },
  { to: '/recurring', icon: 'repeat', label: 'Recurring', secondary: true },
  { to: '/settings', icon: 'settings', label: 'Settings' },
];

function Shell() {
  const { pathname } = useLocation();
  return (
    <div className="shell">
      <nav>
        <div className="brand"><span className="brand-mark">₱</span>Budget</div>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end className={l.secondary ? 'secondary' : undefined}>
            <span className="nav-icon"><Icon name={l.icon} /></span>
            <span className="nav-label">{l.label}</span>
          </NavLink>
        ))}
        <SyncStatus />
      </nav>
      <main>
        {/* key replays the entrance animation on every page change */}
        <div className="page" key={pathname}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/recurring" element={<Recurring />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
      <UpdateToast />
    </div>
  );
}

export default function App() {
  const theme = useTheme();

  useEffect(() => {
    seedDefaults().then(runRecurring);
    return startSync();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'system' ? '' : theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // Storage can be blocked; the theme then just loads a moment later.
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
