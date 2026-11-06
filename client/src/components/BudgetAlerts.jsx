import { formatPeso } from '../money';
import { formatMonth } from '../dates';

export default function BudgetAlerts({ progress, categories, month }) {
  const alerts = progress.filter((p) => p.level !== 'ok'
    && categories.some((c) => c.id === p.category_id && !c.deleted_at && c.type === 'expense'));

  if (alerts.length === 0) return null;

  return (
    <section className="card" aria-label="Budget warnings" aria-live="polite">
      <h2>Budget warnings</h2>
      <p className="hint">All books{month ? ` · ${formatMonth(month)}` : ''}</p>
      {alerts.map((p) => (
        <div key={p.id}>
          <p>
            <strong>{categories.find((c) => c.id === p.category_id).name}</strong>
            {' · '}
            <span className={`status ${p.level}`}>
              {p.level === 'over' ? 'Over budget'
                : p.spent === p.limit_cents ? 'Limit reached (100%)' : 'Near limit (at least 80%)'}
            </span>
          </p>
          <p className="hint">
            {formatPeso(p.spent)} of {formatPeso(p.limit_cents)} · {p.pct}%
            {p.level === 'over' && <span className="expense"> · {formatPeso(p.spent - p.limit_cents)} over</span>}
          </p>
        </div>
      ))}
    </section>
  );
}
