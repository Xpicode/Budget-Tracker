import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { save, softDelete } from '../repo';
import { formatPeso, toCents, centsToInput } from '../money';
import { today, formatDay } from '../dates';
import Sheet from '../components/Sheet';

const FREQ = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

export default function Recurring() {
  const [editing, setEditing] = useState(null); // null = closed, {} = new, row = edit
  const [type, setType] = useState('expense');
  const [error, setError] = useState('');

  const rules = useLiveQuery(() => db.recurring_rules.filter((r) => !r.deleted_at).toArray()) ?? [];
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.deleted_at).toArray()) ?? [];
  const accounts = useLiveQuery(() => db.accounts.filter((a) => !a.deleted_at && !a.archived).toArray()) ?? [];
  const categoryName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const accountName = Object.fromEntries(accounts.map((a) => [a.id, a.name]));

  function open(rule) {
    setError('');
    setType(rule.type ?? 'expense');
    setEditing(rule);
  }

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const amount_cents = toCents(f.get('amount'));
    if (amount_cents === null) {
      setError('Enter an amount above 0 with at most 2 decimals.');
      return;
    }
    await save('recurring_rules', {
      ...editing,
      type,
      amount_cents,
      category_id: f.get('category_id'),
      account_id: f.get('account_id'),
      frequency: f.get('frequency'),
      next_run_date: f.get('next_run_date'),
      note: f.get('note').trim() || null,
    });
    setEditing(null);
  }

  async function remove() {
    await softDelete('recurring_rules', editing.id);
    setEditing(null);
  }

  return (
    <>
      <header className="month-bar"><h1>Recurring</h1></header>
      <p className="hint">Rent, salary, subscriptions. Each rule adds its transaction automatically when the app opens on or after the due date.</p>

      <section className="group">
        {rules.length === 0 && <p className="empty">No rules yet.</p>}
        {rules.map((r) => (
          <button type="button" key={r.id} className="row" onClick={() => open(r)}>
            <span className="row-main">
              <span>{categoryName[r.category_id] ?? '—'}{r.note ? ` · ${r.note}` : ''}</span>
              <small>{FREQ[r.frequency]} · {accountName[r.account_id] ?? '—'} · next {formatDay(r.next_run_date)}</small>
            </span>
            <span className={r.type}>{r.type === 'expense' ? '−' : '+'}{formatPeso(r.amount_cents)}</span>
          </button>
        ))}
      </section>

      <button type="button" className="fab" onClick={() => open({})} aria-label="Add rule">+</button>

      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <form onSubmit={submit}>
            <h2>{editing.id ? 'Edit' : 'Add'} rule</h2>
            <div className="type-toggle">
              {['expense', 'income'].map((t) => (
                <button type="button" key={t} className={t === type ? 'active' : ''} onClick={() => setType(t)}>{t}</button>
              ))}
            </div>
            <label>
              Amount
              <input name="amount" inputMode="decimal" placeholder="0.00" required autoFocus
                defaultValue={editing.amount_cents != null ? centsToInput(editing.amount_cents) : ''} />
            </label>
            <label>
              Category
              <select name="category_id" key={type} required defaultValue={editing.category_id ?? ''}>
                <option value="" disabled>Choose…</option>
                {categories.filter((c) => c.type === type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>
              Account
              <select name="account_id" required defaultValue={editing.account_id ?? accounts[0]?.id ?? ''}>
                <option value="" disabled>Choose…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label>
              Repeats
              <select name="frequency" defaultValue={editing.frequency ?? 'monthly'}>
                {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>
              Next due
              <input type="date" name="next_run_date" required defaultValue={editing.next_run_date ?? today()} />
            </label>
            <label>
              Note
              <input name="note" placeholder="e.g. Rent" defaultValue={editing.note ?? ''} />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="actions">
              {editing.id && <button type="button" className="danger" onClick={remove}>Delete</button>}
              <span className="spacer" />
              <button type="button" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="primary">Save</button>
            </div>
          </form>
        </Sheet>
      )}
    </>
  );
}
