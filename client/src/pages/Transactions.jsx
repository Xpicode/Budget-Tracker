import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { save, softDelete, restore } from '../repo';
import { totals, inBook, filterTransactions } from '../reports';
import { formatPeso } from '../money';
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
  const [undo, setUndo] = useState(null);       // rows just deleted, shown in the toast
  const [picked, setPicked] = useState(null);   // null = normal list, Set of ids = select mode
  const [allHistory, setAllHistory] = useState(false);
  const [filters, setFilters] = useState({ search: '', category_id: '', account_id: '', type: '' });

  const month = shiftMonth(currentMonth(today(), startDay), offset);
  const { from, to } = period(month, startDay);

  // useLiveQuery re-runs the query whenever the table changes, so the list refreshes itself.
  const source = useLiveQuery(async () => {
    const query = allHistory ? db.transactions.toCollection() : db.transactions.where('txn_date').between(from, to, true, false);
    const list = await query
      .filter((t) => !t.deleted_at && inBook(t, book))
      .toArray();
    return list.sort((a, b) => b.txn_date.localeCompare(a.txn_date) || b.created_at.localeCompare(a.created_at));
  }, [from, to, book, allHistory]) ?? [];
  // All categories/accounts for showing names (a deleted one may still be on old rows);
  // only live ones are offered in the form.
  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];

  const rows = filterTransactions(source, filters, categories);
  const { income, expense, net } = totals(source.filter((t) => t.txn_date >= from && t.txn_date < to));
  const matching = totals(rows);
  const byDay = Object.groupBy(rows, (t) => t.txn_date);
  const categoryName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const categoryColor = categoryColors(categories);
  const accountName = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  // Only rows on screen count, so changing the month or book can never delete something you can't see.
  const chosen = picked ? rows.filter((t) => picked.has(t.id)) : [];
  const allChosen = rows.length > 0 && chosen.length === rows.length;

  async function submit(values) {
    await save('transactions', { ...editing, ...values });
    setEditing(null);
  }

  async function removeRows(list) {
    await Promise.all(list.map((row) => softDelete('transactions', row.id)));
    setUndo(list);
    setTimeout(() => setUndo((u) => (u === list ? null : u)), 5000);
  }

  async function remove(row) {
    await removeRows([row]);
    setEditing(null);
  }

  async function removeChosen() {
    const n = chosen.length;
    if (!window.confirm(`Delete ${n} transaction${n === 1 ? '' : 's'}?`)) return;
    await removeRows(chosen);
    setPicked(null);
  }

  async function undoDelete() {
    await Promise.all(undo.map((row) => restore('transactions', row.id)));
    setUndo(null);
  }

  function togglePicked(id) {
    const next = new Set(picked);
    if (!next.delete(id)) next.add(id);
    setPicked(next);
  }

  return (
    <>
      <header className="month-bar">
        <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Previous month"><Icon name="left" /></button>
        <h1>{formatMonth(month)}</h1>
        <button type="button" onClick={() => setOffset(offset + 1)} aria-label="Next month"><Icon name="right" /></button>
      </header>

      <BookFilter />

      <section className="card transaction-filters" aria-label="Search and filters">
        <label>Search transactions<input type="search" placeholder="Note, category, or exact amount" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></label>
        <label>Search scope<select value={allHistory ? 'all' : 'month'} onChange={(e) => setAllHistory(e.target.value === 'all')}><option value="month">Selected budget month</option><option value="all">All history</option></select></label>
        <label>Category<select value={filters.category_id} onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.deleted_at ? ' (deleted)' : ''}</option>)}</select></label>
        <label>Account<select value={filters.account_id} onChange={(e) => setFilters({ ...filters, account_id: e.target.value })}><option value="">All accounts</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.deleted_at || a.archived ? ' (archived)' : ''}</option>)}</select></label>
        <label>Type<select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="">All types</option>{['income', 'expense', 'transfer'].map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <button type="button" className="link" onClick={() => { setFilters({ search: '', category_id: '', account_id: '', type: '' }); setAllHistory(false); setPicked(null); }}>Reset filters</button>
      </section>
      <p className="hint">Selected month totals ({book}). Filters do not change these totals.</p>

      <section className="totals">
        <div><span>Income</span><Money cents={income} animate className="income" /></div>
        <div><span>Expense</span><Money cents={expense} animate className="expense" /></div>
        <div><span>Net</span><Money cents={net} animate /></div>
      </section>

      <p className="hint" role="status">{rows.length} matches ({allHistory ? 'all history' : 'selected month'}): income {formatPeso(matching.income)}, expense {formatPeso(matching.expense)}, net {formatPeso(matching.net)}.</p>
      {rows.length === 0 && <p className="empty">No matching transactions. Adjust the search or filters, or press + to add one.</p>}

      {rows.length > 0 && (
        <div className="list-tools">
          <button type="button" className="link"
            onClick={() => setPicked(!picked ? new Set() : new Set(allChosen ? [] : rows.map((t) => t.id)))}>
            {!picked ? 'Select' : allChosen ? 'Clear' : 'Select all'}
          </button>
        </div>
      )}

      {Object.entries(byDay).map(([day, list]) => (
        <section key={day} className="group">
          <h2>{formatDay(day)}</h2>
          {list.map((t) => (
            <button type="button" key={t.id} className={picked?.has(t.id) ? 'row picked' : 'row'} aria-pressed={picked ? picked.has(t.id) : undefined}
              onClick={() => (picked ? togglePicked(t.id) : setEditing(t))}>
              {picked ? (
                <span className="check"><Icon name="check" size={18} /></span>
              ) : (
                <span className="avatar" style={{ '--c': categoryColor[t.category_id] ?? 'var(--accent)' }}>
                  {t.type === 'transfer' ? <Icon name="transfer" size={18} /> : (categoryName[t.category_id] ?? '?').slice(0, 1)}
                </span>
              )}
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

      {picked ? (
        <div className="select-bar">
          <button type="button" onClick={() => setPicked(null)}>Cancel</button>
          <span role="status">{chosen.length} selected</span>
          <button type="button" className="danger" disabled={chosen.length === 0} onClick={removeChosen}>Delete</button>
        </div>
      ) : (
        <button type="button" className="fab" onClick={() => setEditing({})} aria-label="Add transaction"><Icon name="plus" size={26} /></button>
      )}

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
          {undo.length > 1 ? `${undo.length} deleted` : 'Deleted'} <button type="button" onClick={undoDelete}>Undo</button>
        </div>
      )}
    </>
  );
}
