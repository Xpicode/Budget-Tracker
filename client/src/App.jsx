import { useEffect } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { seedDefaults } from './repo';
import Transactions from './pages/Transactions';
import Accounts from './pages/Accounts';
import Categories from './pages/Categories';
import UpdateToast from './components/UpdateToast';

export default function App() {
  useEffect(() => {
    seedDefaults();
  }, []);

  return (
    <BrowserRouter>
      <div className="shell">
        <nav>
          <NavLink to="/">Transactions</NavLink>
          <NavLink to="/accounts">Accounts</NavLink>
          <NavLink to="/categories">Categories</NavLink>
        </nav>
        <main>
          <Routes>
            <Route path="/" element={<Transactions />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/categories" element={<Categories />} />
          </Routes>
        </main>
        <UpdateToast />
      </div>
    </BrowserRouter>
  );
}
