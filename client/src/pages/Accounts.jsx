import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { save } from '../repo';
import { formatPeso, parseCents, centsToInput } from '../money';
import { balances, accountFits } from '../reports';
import { useBook } from '../settings';
import Sheet from '../components/Sheet';
import Money from '../components/Money';
import Icon from '../components/Icon';
import BookFilter, { BookSwitch } from '../components/BookFilter';

const BOOK_LABEL = { personal: 'Personal', business: 'Business' }; // 'both' shows no tag
const TOTAL_LABEL = { all: 'Total balance', personal: 'Personal balance', business: 'Business balance' };

export default function Accounts() {
  const view = useBook(); // the All / Personal / Business filter, shared with the other pages
  const [editing, setEditing] = useState(null); // null = closed, {} = new, row = edit
  const [book, setBook] = useState('personal');
  const [error, setError] = useState('');

  const all = useLiveQuery(() => db.accounts.filter((a) => !a.deleted_at).sortBy('name')) ?? [];
  // ponytail: loads every live transaction to compute balances; fine for one person's data
  const txns = useLiveQuery(() => db.transactions.filter((t) => !t.deleted_at).toArray()) ?? [];
  const balance = balances(all, txns); // a balance is the money in the account, whatever book each row is in
  const accounts = all.filter((a) => accountFits(a, view));
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const total = active.reduce((s, a) => s + balance[a.id], 0);

  function open(account) {
    setError('');
    // A new account starts in the book you're looking at.
    setBook(account.book ?? (view === 'all' ? 'personal' : view));
    setEditing(account);
  }

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const opening_balance_cents = parseCents(f.get('opening'));
    if (opening_balance_cents === null) {
      setError('Enter a number with at most 2 decimals (negative is allowed).');
      return;
    }
    await save('accounts', { archived: false, ...editing, name: f.get('name').trim(), opening_balance_cents, book });
    setEditing(null);
  }

  async function toggleArchive() {
    await save('accounts', { ...editing, archived: !editing.archived });
    setEditing(null);
  }

  const list = (items) => items.map((a) => (
    <button type="button" key={a.id} className="row" onClick={() => open(a)}>
      <span className="row-main">
        <span>{a.name}</span>
        <small>
          {view === 'all' && BOOK_LABEL[a.book ?? 'personal'] && <span className={`badge ${a.book ?? 'personal'}`}>{BOOK_LABEL[a.book ?? 'personal']}</span>}
          Opening {formatPeso(a.opening_balance_cents)}
        </small>
      </span>
      <Money cents={balance[a.id]} className={balance[a.id] < 0 ? 'expense' : ''} />
    </button>
  ));

  return (
    <>
      <header className="month-bar"><h1>Accounts</h1></header>
      <BookFilter />

      <section className="totals one">
        <div><span>{TOTAL_LABEL[view]}</span><Money cents={total} animate className={total < 0 ? 'expense' : ''} /></div>
      </section>

      <section className="group">
        <h2>Active</h2>
        {active.length === 0 && <p className="empty">No accounts here yet. Press + to add one.</p>}
        {list(active)}
      </section>

      {archived.length > 0 && (
        <section className="group">
          <h2>Archived</h2>
          {list(archived)}
        </section>
      )}

      <button type="button" className="fab" onClick={() => open({})} aria-label="Add account"><Icon name="plus" size={26} /></button>

      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <form onSubmit={submit}>
            <h2>{editing.id ? 'Edit' : 'Add'} account</h2>
            <label>
              Name
              <input name="name" required autoFocus placeholder="Cash, GCash, BDO…" defaultValue={editing.name ?? ''} />
            </label>
            <label>
              Used for
              <BookSwitch value={book} onChange={setBook} both />
            </label>
            <label>
              Opening balance
              <input
                name="opening"
                inputMode="decimal"
                required
                defaultValue={editing.opening_balance_cents != null ? centsToInput(editing.opening_balance_cents) : '0.00'}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="actions">
              {editing.id && (
                <button type="button" onClick={toggleArchive}>{editing.archived ? 'Unarchive' : 'Archive'}</button>
              )}
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
