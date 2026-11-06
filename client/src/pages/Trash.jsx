import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { restore } from '../repo';
import { inBook } from '../reports';
import { useBook } from '../settings';
import BookFilter from '../components/BookFilter';
import Money from '../components/Money';
import { formatDay } from '../dates';

export default function Trash() {
  const book = useBook();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const rows = useLiveQuery(() => db.transactions.filter((t) => !!t.deleted_at && inBook(t, book)).toArray(), [book]) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const name = (list, id) => list.find((row) => row.id === id)?.name ?? 'Unknown';

  async function restoreRow(id) {
    setBusy(id);
    setError('');
    try {
      await restore('transactions', id);
    } catch {
      setError('Could not restore this transaction. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return <>
    <header className="month-bar"><h1>Trash</h1></header>
    <BookFilter />
    <p className="hint">Deleted transactions from all history. Restoring updates balances and budgets and syncs when online.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {!rows.length && <p className="empty">No deleted transactions.</p>}
    <section className="group">
      {[...rows].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at)).map((t) => <div className="row" key={t.id}>
        <span className="row-main">
          <span>{t.type === 'transfer' ? `${name(accounts, t.account_id)} to ${name(accounts, t.to_account_id)}` : name(categories, t.category_id)}</span>
          <small>{formatDay(t.txn_date)} · {t.type} · {name(accounts, t.account_id)}</small>
          {t.note && <small>{t.note}</small>}
          <small>Deleted {new Date(t.deleted_at).toLocaleString()}</small>
          <Money cents={t.amount_cents} className={t.type} />
        </span>
        <button type="button" disabled={busy !== null} onClick={() => restoreRow(t.id)}>{busy === t.id ? 'Restoring...' : 'Restore'}</button>
      </div>)}
    </section>
  </>;
}
