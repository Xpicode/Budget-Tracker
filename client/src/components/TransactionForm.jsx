import { useState } from 'react';
import { toCents, centsToInput } from '../money';
import { today } from '../dates';
import Sheet from './Sheet';

const TYPES = ['expense', 'income', 'transfer'];

export default function TransactionForm({ initial, categories, accounts, onSubmit, onDelete, onClose }) {
  const [type, setType] = useState(initial.type ?? 'expense');
  const [error, setError] = useState('');
  const isTransfer = type === 'transfer';

  function handleSubmit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const amount_cents = toCents(f.get('amount'));
    if (amount_cents === null) {
      setError('Enter an amount above 0 with at most 2 decimals.');
      return;
    }
    const account_id = f.get('account_id');
    const to_account_id = isTransfer ? f.get('to_account_id') : null;
    if (isTransfer && to_account_id === account_id) {
      setError('Pick two different accounts.');
      return;
    }
    onSubmit({
      type,
      amount_cents,
      account_id,
      to_account_id,
      category_id: isTransfer ? null : f.get('category_id'),
      txn_date: f.get('txn_date'),
      note: f.get('note').trim() || null,
    });
  }

  const accountOptions = accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>);

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2>{initial.id ? 'Edit' : 'Add'} transaction</h2>

        <div className="type-toggle">
          {TYPES.map((t) => (
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
            defaultValue={initial.amount_cents != null ? centsToInput(initial.amount_cents) : ''}
          />
        </label>

        {!isTransfer && (
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
        )}

        <label>
          {isTransfer ? 'From' : 'Account'}
          <select name="account_id" required defaultValue={initial.account_id ?? accounts[0]?.id ?? ''}>
            <option value="" disabled>Choose…</option>
            {accountOptions}
          </select>
        </label>

        {isTransfer && (
          <label>
            To
            <select name="to_account_id" required defaultValue={initial.to_account_id ?? accounts[1]?.id ?? ''}>
              <option value="" disabled>Choose…</option>
              {accountOptions}
            </select>
          </label>
        )}

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
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary">Save</button>
        </div>
      </form>
    </Sheet>
  );
}
