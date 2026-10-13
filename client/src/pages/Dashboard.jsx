import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { db } from '../db';
import { formatPeso } from '../money';
import { balances, totals, spendingByCategory, monthlyExpenses } from '../reports';
import { today, shiftMonth, formatMonth } from '../dates';

// Fixed categorical order (colour-blind-safe set); a category keeps its colour as others come and go.
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const OTHER = '#9ca3af';
const MAX_SLICES = 7;

const tick = { fill: 'var(--muted)', fontSize: 12 };
const axisPeso = (cents) => `₱${Math.round(cents / 100).toLocaleString('en-PH')}`;

export default function Dashboard() {
  const month = today().slice(0, 7);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));

  const accounts = useLiveQuery(() => db.accounts.filter((a) => !a.deleted_at && !a.archived).toArray()) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const txns = useLiveQuery(() => db.transactions.filter((t) => !t.deleted_at).toArray()) ?? [];
  const monthTxns = txns.filter((t) => t.txn_date.startsWith(month));

  const balance = balances(accounts, txns);
  const total = accounts.reduce((s, a) => s + balance[a.id], 0);
  const { income, expense, net } = totals(monthTxns);

  // Colour by entity: index in the name-sorted list, unless the user picked a colour.
  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  const colorOf = (id) => sorted.find((c) => c.id === id)?.color ?? PALETTE[sorted.findIndex((c) => c.id === id) % PALETTE.length];
  const nameOf = (id) => categories.find((c) => c.id === id)?.name ?? '—';

  const spending = spendingByCategory(monthTxns);
  const slices = spending.slice(0, MAX_SLICES).map((s) => ({ name: nameOf(s.category_id), cents: s.cents, color: colorOf(s.category_id) }));
  const rest = spending.slice(MAX_SLICES).reduce((s, x) => s + x.cents, 0);
  if (rest > 0) slices.push({ name: 'Other', cents: rest, color: OTHER });

  const trend = monthlyExpenses(txns, months).map((m) => ({
    ...m,
    label: new Date(m.month + '-01T00:00').toLocaleDateString('en-PH', { month: 'short' }),
  }));

  return (
    <>
      <header className="month-bar"><h1>{formatMonth(month)}</h1></header>

      <section className="totals four">
        <div><span>Total balance</span><strong className={total < 0 ? 'expense' : ''}>{formatPeso(total)}</strong></div>
        <div><span>Income</span><strong className="income">{formatPeso(income)}</strong></div>
        <div><span>Expenses</span><strong className="expense">{formatPeso(expense)}</strong></div>
        <div><span>Net</span><strong>{formatPeso(net)}</strong></div>
      </section>

      <section className="card chart">
        <h2>Spending by category</h2>
        {slices.length === 0 ? (
          <p className="empty">No expenses yet this month.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={slices} dataKey="cents" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="var(--card)" strokeWidth={2}>
                {slices.map((s) => <Cell key={s.name} fill={s.color} />)}
              </Pie>
              <Tooltip formatter={(value) => formatPeso(value)} />
              <Legend iconType="circle" iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="card chart">
        <h2>Expenses, last 6 months</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} />
            <YAxis tick={tick} tickFormatter={axisPeso} tickLine={false} axisLine={false} width={64} />
            <Tooltip formatter={(value) => [formatPeso(value), 'Expenses']} labelFormatter={(_, p) => p[0] && formatMonth(p[0].payload.month)} cursor={{ fill: 'var(--bg)' }} />
            <Bar dataKey="cents" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </>
  );
}
