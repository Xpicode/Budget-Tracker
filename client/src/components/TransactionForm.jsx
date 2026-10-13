import { useEffect, useRef, useState } from 'react';
import { toCents } from '../money';
import { today } from '../dates';

export default function TransactionForm({ initial, categories, accounts, onSubmit, onDelete, onClose }) {
  const dialog = useRef(null);
  const [type, setType] = useState(initial.type ?? 'expense');
  const [error, setError] = useState('');

  // A native <dialog> gives us the backdrop, focus trap and Esc-to-close for free.
  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const amount_cents = toCents(f.get('amount'));
    if (amount_cents === null) {
      setError('Enter an amount above 0 with at most 2 decimals.');
      return;
    }
    onSubmit({
      type,
      amount_cents,
      category_id: f.get('category_id'),
      account_id: f.get('account_id'),
      txn_date: f.get('txn_date'),
      note: f.get('note').trim() || null,
    });
  }

  return (
    <dialog ref={dialog} className="sheet" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2>{initial.id ? 'Edit' : 'Add'} transaction</h2>

        <div className="type-toggle">
          {['expense', 'income'].map((t) => (
            <button type="button" key={t} className={t === type ? 'active' : ''} onClick={() => setType(t)}>
              {t}
            </button>
          ))}
        </div>

        <label>
          Amount
          <input
            name="amount"
            inputMode="decimal"
            placeholder="0.00"
            required
            autoFocus
            defaultValue={initial.amount_cents != null ? (initial.amount_cents / 100).toFixed(2) : ''}
          />
        </label>

        <label>
          Category
          {/* key={type} remounts the select when the type changes, so a stale pick is cleared */}
          <select name="category_id" key={type} required defaultValue={initial.category_id ?? ''}>
            <option value="" disabled>Choose…</option>
            {categories.filter((c) => c.type === type).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label>
          Account
          <select name="account_id" required defaultValue={initial.account_id ?? accounts[0]?.id ?? ''}>
            <option value="" disabled>Choose…</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>

        <label>
          Date
          <input type="date" name="txn_date" required defaultValue={initial.txn_date ?? today()} />
        </label>

        <label>
          Note
          <input name="note" placeholder="Optional" defaultValue={initial.note ?? ''} />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          {onDelete && <button type="button" className="danger" onClick={onDelete}>Delete</button>}
          <span className="spacer" />
          <button type="button" onClick={() => dialog.current.close()}>Cancel</button>
          <button type="submit" className="primary">Save</button>
        </div>
      </form>
    </dialog>
  );
}
