import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { save, softDelete } from '../repo';
import { formatPeso } from '../money';
import { today, shiftMonth, formatDay, formatMonth } from '../dates';
import TransactionForm from '../components/TransactionForm';

export default function Transactions() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [editing, setEditing] = useState(null); // null = form closed, {} = new, row = edit
  const [undo, setUndo] = useState(null);       // last deleted row, shown in the toast

  // useLiveQuery re-runs the query whenever the table changes, so the list refreshes itself.
  const rows = useLiveQuery(async () => {
    const list = await db.transactions
      .where('txn_date').between(`${month}-01`, `${month}-31`, true, true)
      .filter((t) => !t.deleted_at)
      .toArray();
    return list.sort((a, b) => b.txn_date.localeCompare(a.txn_date) || b.created_at.localeCompare(a.created_at));
  }, [month]) ?? [];
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.deleted_at).toArray()) ?? [];
  const accounts = useLiveQuery(() => db.accounts.filter((a) => !a.deleted_at && !a.archived).toArray()) ?? [];

  const sum = (type) => rows.filter((t) => t.type === type).reduce((s, t) => s + t.amount_cents, 0);
  const income = sum('income');
  const expense = sum('expense');
  const byDay = Object.groupBy(rows, (t) => t.txn_date);
  const categoryName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const accountName = Object.fromEntries(accounts.map((a) => [a.id, a.name]));

  async function submit(values) {
    await save('transactions', { ...editing, ...values });
    setEditing(null);
  }

  async function remove(row) {
    await softDelete('transactions', row.id);
    setEditing(null);
    setUndo(row);
    setTimeout(() => setUndo((u) => (u?.id === row.id ? null : u)), 5000);
  }

  async function undoDelete() {
    await save('transactions', { ...undo, deleted_at: null });
    setUndo(null);
  }

  return (
    <>
      <header className="month-bar">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
        <h1>{formatMonth(month)}</h1>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">›</button>
      </header>

      <section className="totals">
        <div><span>Income</span><strong className="income">{formatPeso(income)}</strong></div>
        <div><span>Expense</span><strong className="expense">{formatPeso(expense)}</strong></div>
        <div><span>Net</span><strong>{formatPeso(income - expense)}</strong></div>
      </section>

      {rows.length === 0 && <p className="empty">No transactions this month.</p>}

      {Object.entries(byDay).map(([day, list]) => (
        <section key={day} className="day">
          <h2>{formatDay(day)}</h2>
          {list.map((t) => (
            <button type="button" key={t.id} className="row" onClick={() => setEditing(t)}>
              <span className="row-main">
                <span>{categoryName[t.category_id] ?? '—'}</span>
                <small>{t.note || accountName[t.account_id]}</small>
              </span>
              <span className={t.type}>{t.type === 'expense' ? '−' : '+'}{formatPeso(t.amount_cents)}</span>
            </button>
          ))}
        </section>
      ))}

      <button type="button" className="fab" onClick={() => setEditing({})} aria-label="Add transaction">+</button>

      {editing && (
        <TransactionForm
          initial={editing}
          categories={categories}
          accounts={accounts}
          onSubmit={submit}
          onDelete={editing.id ? () => remove(editing) : null}
          onClose={() => setEditing(null)}
        />
      )}

      {undo && (
        <div className="toast" role="status">
          Deleted <button type="button" onClick={undoDelete}>Undo</button>
        </div>
      )}
    </>
  );
}
