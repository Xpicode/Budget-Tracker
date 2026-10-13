import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { save, softDelete, budgetId } from '../repo';
import { formatPeso, toCents, centsToInput } from '../money';
import { budgetProgress } from '../reports';
import { today, shiftMonth, formatMonth } from '../dates';
import Sheet from '../components/Sheet';

const STATUS = { ok: '', warn: 'Near limit', over: 'Over budget' };

export default function Budgets() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [editing, setEditing] = useState(null); // { category, budget } while the sheet is open
  const [error, setError] = useState('');

  const categories = useLiveQuery(() => db.categories.filter((c) => !c.deleted_at && c.type === 'expense').toArray()) ?? [];
  const budgets = useLiveQuery(() => db.budgets.filter((b) => !b.deleted_at && b.month === month).toArray(), [month]) ?? [];
  const txns = useLiveQuery(
    () => db.transactions.where('txn_date').between(`${month}-01`, `${month}-31`, true, true).filter((t) => !t.deleted_at).toArray(),
    [month],
  ) ?? [];

  const progress = Object.fromEntries(budgetProgress(budgets, txns).map((p) => [p.category_id, p]));

  async function submit(e) {
    e.preventDefault();
    const limit_cents = toCents(new FormData(e.target).get('limit'));
    if (limit_cents === null) {
      setError('Enter an amount above 0 with at most 2 decimals.');
      return;
    }
    const { category, budget } = editing;
    await save('budgets', {
      ...budget,
      id: budgetId(category.id, month),
      category_id: category.id,
      month,
      limit_cents,
      deleted_at: null, // re-setting a removed budget revives the same row
    });
    setEditing(null);
  }

  async function removeLimit() {
    await softDelete('budgets', editing.budget.id);
    setEditing(null);
  }

  return (
    <>
      <header className="month-bar">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
        <h1>{formatMonth(month)}</h1>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">›</button>
      </header>

      <section className="group">
        <h2>Budgets</h2>
        {categories.length === 0 && <p className="empty">Add an expense category first.</p>}
        {categories.map((c) => {
          const p = progress[c.id];
          return (
            <button type="button" key={c.id} className="row budget" onClick={() => { setError(''); setEditing({ category: c, budget: budgets.find((b) => b.category_id === c.id) }); }}>
              <span className="row-main">
                <span>{c.name}{p && STATUS[p.level] && <small className={`status ${p.level}`}> · {STATUS[p.level]}</small>}</span>
                {p ? (
                  <>
                    <span className="meter"><span className={`meter-fill ${p.level}`} style={{ width: `${Math.min(p.pct, 100)}%` }} /></span>
                    <small>
                      {formatPeso(p.spent)} of {formatPeso(p.limit_cents)} · {p.pct}%
                      {p.level === 'over' && <span className="expense"> · {formatPeso(p.spent - p.limit_cents)} over</span>}
                    </small>
                  </>
                ) : (
                  <small>No limit set</small>
                )}
              </span>
            </button>
          );
        })}
      </section>

      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <form onSubmit={submit}>
            <h2>{editing.category.name} · {formatMonth(month)}</h2>
            <label>
              Monthly limit
              <input
                name="limit"
                inputMode="decimal"
                placeholder="0.00"
                required
                autoFocus
                defaultValue={editing.budget ? centsToInput(editing.budget.limit_cents) : ''}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="actions">
              {editing.budget && <button type="button" className="danger" onClick={removeLimit}>Remove limit</button>}
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
