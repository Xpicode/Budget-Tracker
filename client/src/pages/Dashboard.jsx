import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { db } from '../db';
import { formatPeso } from '../money';
import { balances, totals, spendingByCategory, monthlyExpenses, inBook, accountFits } from '../reports';
import { useSetting } from '../settings';
import { today, shiftMonth, period, currentMonth, formatMonth } from '../dates';
import Money from '../components/Money';
import BookFilter from '../components/BookFilter';
import { useBook } from '../settings';
import { categoryColors } from '../colors';

const OTHER = '#9ca3af';
const MAX_SLICES = 7;

const tick = { fill: 'var(--muted)', fontSize: 12 };
const axisPeso = (cents) => `₱${Math.round(cents / 100).toLocaleString('en-PH')}`;

export default function Dashboard() {
  const startDay = useSetting('budget_start', 1);
  const month = currentMonth(today(), startDay);
  const periods = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(month, i - 5);
    return { month: m, ...period(m, startDay) };
  });
  const { from, to } = periods[5];

  const accounts = useLiveQuery(() => db.accounts.filter((a) => !a.deleted_at && !a.archived).toArray()) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const txns = useLiveQuery(() => db.transactions.filter((t) => !t.deleted_at).toArray()) ?? [];
  const book = useBook();
  // Totals and charts follow the book filter. The balance card adds up this book's accounts,
  // each with every row in it (money in an account is the same money whichever book a row is in).
  const bookTxns = txns.filter((t) => inBook(t, book));
  const monthTxns = bookTxns.filter((t) => t.txn_date >= from && t.txn_date < to);

  const balance = balances(accounts, txns);
  const total = accounts.filter((a) => accountFits(a, book)).reduce((s, a) => s + balance[a.id], 0);
  const { income, expense, net } = totals(monthTxns);
  const spentShare = income > 0 ? Math.round((expense / income) * 100) : null;

  const colors = categoryColors(categories);
  const colorOf = (id) => colors[id] ?? OTHER;
  const nameOf = (id) => categories.find((c) => c.id === id)?.name ?? '—';

  const spending = spendingByCategory(monthTxns);
  const slices = spending.slice(0, MAX_SLICES).map((s) => ({ name: nameOf(s.category_id), cents: s.cents, color: colorOf(s.category_id) }));
  const rest = spending.slice(MAX_SLICES).reduce((s, x) => s + x.cents, 0);
  if (rest > 0) slices.push({ name: 'Other', cents: rest, color: OTHER });

  const trend = monthlyExpenses(bookTxns, periods).map((m) => ({
    ...m,
    label: new Date(m.month + '-01T00:00').toLocaleDateString('en-PH', { month: 'short' }),
  }));

  return (
    <>
      <header className="month-bar">
        <div>
          <p className="eyebrow">This month</p>
          <h1>{formatMonth(month)}</h1>
        </div>
      </header>

      <BookFilter />

      <section className="hero">
        <span className="hero-label">{book === 'business' ? 'Business profit' : 'Left after spending'}</span>
        <Money cents={net} animate className={`hero-amount ${net < 0 ? 'expense' : ''}`} />
        {spentShare !== null && (
          <div className="ratio" title={`${spentShare}% of income spent`}>
            <span className={spentShare > 100 ? 'over' : ''} style={{ width: `${Math.min(spentShare, 100)}%` }} />
          </div>
        )}
        <p className="hero-note">
          {book === 'business'
            ? (spentShare === null ? 'No sales recorded yet this month.' : `Costs are ${spentShare}% of sales.`)
            : (spentShare === null ? 'No income recorded yet this month.' : `You've spent ${spentShare}% of what came in.`)}
        </p>
        <div className="hero-split">
          <div><span>Income</span><Money cents={income} animate className="income" /></div>
          <div><span>Expenses</span><Money cents={expense} animate className="expense" /></div>
          <div><span>{{ all: 'All accounts', personal: 'Personal accounts', business: 'Business accounts' }[book]}</span><Money cents={total} animate /></div>
        </div>
      </section>

      <section className="card chart">
        <h2>Where it went</h2>
        {slices.length === 0 ? (
          <p className="empty">No expenses yet this month. Add one from Transactions.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={slices} dataKey="cents" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}
                cornerRadius={4} stroke="var(--card)" strokeWidth={2} animationDuration={700}>
                {slices.map((s) => <Cell key={s.name} fill={s.color} />)}
              </Pie>
              <Tooltip formatter={(value) => formatPeso(value)} />
              <Legend iconType="circle" iconSize={9} />
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
            <Tooltip formatter={(value) => [formatPeso(value), 'Expenses']} labelFormatter={(_, p) => p[0] && formatMonth(p[0].payload.month)} cursor={{ fill: 'var(--accent-soft)' }} />
            <Bar dataKey="cents" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={44} animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </>
  );
}
