import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { save } from '../repo';
import { formatPeso, parseCents, centsToInput } from '../money';
import { balances } from '../reports';
import Sheet from '../components/Sheet';

export default function Accounts() {
  const [editing, setEditing] = useState(null); // null = closed, {} = new, row = edit
  const [error, setError] = useState('');

  const accounts = useLiveQuery(() => db.accounts.filter((a) => !a.deleted_at).toArray()) ?? [];
  // ponytail: loads every live transaction to compute balances; fine for one person's data
  const txns = useLiveQuery(() => db.transactions.filter((t) => !t.deleted_at).toArray()) ?? [];
  const balance = balances(accounts, txns);
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const total = active.reduce((s, a) => s + balance[a.id], 0);

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const opening_balance_cents = parseCents(f.get('opening'));
    if (opening_balance_cents === null) {
      setError('Enter a number with at most 2 decimals (negative is allowed).');
      return;
    }
    await save('accounts', { archived: false, ...editing, name: f.get('name').trim(), opening_balance_cents });
    setEditing(null);
  }

  async function toggleArchive() {
    await save('accounts', { ...editing, archived: !editing.archived });
    setEditing(null);
  }

  const list = (items) => items.map((a) => (
    <button type="button" key={a.id} className="row" onClick={() => { setError(''); setEditing(a); }}>
      <span className="row-main">
        <span>{a.name}</span>
        <small>Opening {formatPeso(a.opening_balance_cents)}</small>
      </span>
      <span className={balance[a.id] < 0 ? 'expense' : ''}>{formatPeso(balance[a.id])}</span>
    </button>
  ));

  return (
    <>
      <header className="month-bar"><h1>Accounts</h1></header>

      <section className="totals one">
        <div><span>Total balance</span><strong className={total < 0 ? 'expense' : ''}>{formatPeso(total)}</strong></div>
      </section>

      <section className="group">
        <h2>Active</h2>
        {active.length === 0 && <p className="empty">No accounts yet.</p>}
        {list(active)}
      </section>

      {archived.length > 0 && (
        <section className="group">
          <h2>Archived</h2>
          {list(archived)}
        </section>
      )}

      <button type="button" className="fab" onClick={() => { setError(''); setEditing({}); }} aria-label="Add account">+</button>

      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <form onSubmit={submit}>
            <h2>{editing.id ? 'Edit' : 'Add'} account</h2>
            <label>
              Name
              <input name="name" required autoFocus placeholder="Cash, GCash, BDO…" defaultValue={editing.name ?? ''} />
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
