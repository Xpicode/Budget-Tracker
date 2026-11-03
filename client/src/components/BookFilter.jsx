import { useBook, setSetting } from '../settings';

const OPTIONS = [['all', 'All'], ['personal', 'Personal'], ['business', 'Business']];

export default function BookFilter() {
  const book = useBook();
  return (
    <div className="type-toggle book-filter" role="group" aria-label="Show">
      {OPTIONS.map(([value, label]) => (
        <button type="button" key={value} className={value === book ? 'active' : ''} aria-pressed={value === book}
          onClick={() => setSetting('book', value)}>
          {label}
        </button>
      ))}
    </div>
  );
}

// Personal / Business switch inside a form.
export function BookSwitch({ value, onChange }) {
  return (
    <div className="type-toggle book-switch" role="group" aria-label="Book">
      {OPTIONS.slice(1).map(([v, label]) => (
        <button type="button" key={v} className={v === value ? 'active' : ''} aria-pressed={v === value} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}
