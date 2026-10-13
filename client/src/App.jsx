import { useEffect } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { seedDefaults } from './repo';
import Transactions from './pages/Transactions';

export default function App() {
  useEffect(() => {
    seedDefaults();
  }, []);

  return (
    <BrowserRouter>
      <div className="shell">
        <nav>
          <NavLink to="/">Transactions</NavLink>
        </nav>
        <main>
          <Routes>
            <Route path="/" element={<Transactions />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
