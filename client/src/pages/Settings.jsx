import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db';
import { useSetting, setSetting, useTheme } from '../settings';
import { centsToInput } from '../money';
import { today, period } from '../dates';
import { toCsv, downloadCsv } from '../csv';
import Account from './Account';

const THEMES = [['light', 'Light'], ['dark', 'Dark'], ['system', 'Auto']];

export default function Settings() {
  const budgetStart = useSetting('budget_start', 1);
  const theme = useTheme();
  const thisMonth = period(today().slice(0, 7));
  const [range, setRange] = useState({ from: thisMonth.from, to: today() });

  async function exportCsv() {
    const [txns, categories, accounts] = await Promise.all([
      db.transactions.where('txn_date').between(range.from, range.to, true, true).filter((t) => !t.deleted_at).sortBy('txn_date'),
      db.categories.toArray(),
      db.accounts.toArray(),
    ]);
    const name = (list, id) => list.find((x) => x.id === id)?.name ?? '';
    const rows = txns.map((t) => [
      t.txn_date, t.type, name(categories, t.category_id), name(accounts, t.account_id),
      name(accounts, t.to_account_id), centsToInput(t.amount_cents), t.note, t.book ?? 'personal',
    ]);
    downloadCsv(`budget-${range.from}_${range.to}.csv`, toCsv(['date', 'type', 'category', 'account', 'to_account', 'amount', 'note', 'book'], rows));
  }

  return (
    <>
      <header className="month-bar"><h1>Settings</h1></header>

      <h2 className="section">Appearance</h2>
      <section className="card">
        <div className="type-toggle" role="group" aria-label="Theme">
          {THEMES.map(([value, label]) => (
            <button type="button" key={value} className={value === theme ? 'active' : ''} aria-pressed={value === theme}
              onClick={() => setSetting('theme', value)}>
              {label}
            </button>
          ))}
        </div>
        <p className="hint">Auto follows your device's light or dark setting.</p>
      </section>

      <h2 className="section">Account</h2>
      <Account />

      <h2 className="section">Preferences</h2>
      <section className="card">
        <label>
          Budget month starts on day
          <select value={budgetStart} onChange={(e) => setSetting('budget_start', Number(e.target.value))}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </section>

      <h2 className="section">Export</h2>
      <section className="card">
        <div className="range">
          <label>From<input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
          <label>To<input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        </div>
        <button type="button" className="primary" onClick={exportCsv}>Download CSV</button>
        <p className="hint">Opens in Excel or Google Sheets.</p>
      </section>

      <h2 className="section">Manage</h2>
      <section className="group">
        <Link to="/accounts" className="row">Accounts</Link>
        <Link to="/categories" className="row">Categories</Link>
        <Link to="/recurring" className="row">Recurring rules</Link>
      </section>
    </>
  );
}
