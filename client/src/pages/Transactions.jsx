import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { save, softDelete } from '../repo';
import { totals, inBook } from '../reports';
import BookFilter from '../components/BookFilter';
import { useBook } from '../settings';
import { useSetting } from '../settings';
import { today, shiftMonth, period, currentMonth, formatDay, formatMonth } from '../dates';
import TransactionForm from '../components/TransactionForm';
import Money from '../components/Money';
import Icon from '../components/Icon';
import { categoryColors } from '../colors';

export default function Transactions() {
  const startDay = useSetting('budget_start', 1);
  const book = useBook();
  const [offset, setOffset] = useState(0);      // months away from the current budget period
  const [editing, setEditing] = useState(null); // null = form closed, {} = new, row = edit
  const [undo, setUndo] = useState(null);       // last deleted row, shown in the toast

  const month = shiftMonth(currentMonth(today(), startDay), offset);
  const { from, to } = period(month, startDay);

  // useLiveQuery re-runs the query whenever the table changes, so the list refreshes itself.
  const rows = useLiveQuery(async () => {
    const list = await db.transactions
      .where('txn_date').between(from, to, true, false)
      .filter((t) => !t.deleted_at && inBook(t, book))
      .toArray();
    return list.sort((a, b) => b.txn_date.localeCompare(a.txn_date) || b.created_at.localeCompare(a.created_at));
  }, [from, to, book]) ?? [];
  // All categories/accounts for showing names (a deleted one may still be on old rows);
  // only live ones are offered in the form.
  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];

  const { income, expense, net } = totals(rows);
  const byDay = Object.groupBy(rows, (t) => t.txn_date);
  const categoryName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const categoryColor = categoryColors(categories);
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
        <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Previous month"><Icon name="left" /></button>
        <h1>{formatMonth(month)}</h1>
        <button type="button" onClick={() => setOffset(offset + 1)} aria-label="Next month"><Icon name="right" /></button>
      </header>

      <BookFilter />

      <section className="totals">
        <div><span>Income</span><Money cents={income} animate className="income" /></div>
        <div><span>Expense</span><Money cents={expense} animate className="expense" /></div>
        <div><span>Net</span><Money cents={net} animate /></div>
      </section>

      {rows.length === 0 && <p className="empty">Nothing recorded this month. Press + to add an expense or income.</p>}

      {Object.entries(byDay).map(([day, list]) => (
        <section key={day} className="group">
          <h2>{formatDay(day)}</h2>
          {list.map((t) => (
            <button type="button" key={t.id} className="row" onClick={() => setEditing(t)}>
              <span className="avatar" style={{ '--c': categoryColor[t.category_id] ?? 'var(--accent)' }}>
                {t.type === 'transfer' ? <Icon name="transfer" size={18} /> : (categoryName[t.category_id] ?? '?').slice(0, 1)}
              </span>
              <span className="row-main">
                <span>
                  {t.type === 'transfer'
                    ? `${accountName[t.account_id] ?? '—'} → ${accountName[t.to_account_id] ?? '—'}`
                    : categoryName[t.category_id] ?? '—'}
                </span>
                <small>
                  {book === 'all' && t.book === 'business' && <span className="badge">Business</span>}
                  {t.note || (t.type === 'transfer' ? 'Transfer' : accountName[t.account_id])}
                </small>
              </span>
              <Money cents={t.amount_cents} className={t.type} sign={t.type === 'expense' ? '−' : t.type === 'income' ? '+' : ''} />
            </button>
          ))}
        </section>
      ))}

      <button type="button" className="fab" onClick={() => setEditing({})} aria-label="Add transaction"><Icon name="plus" size={26} /></button>

      {editing && (
        <TransactionForm
          initial={editing}
          defaultBook={book === 'all' ? 'personal' : book}
          categories={categories.filter((c) => !c.deleted_at)}
          accounts={accounts.filter((a) => !a.deleted_at && !a.archived)}
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
