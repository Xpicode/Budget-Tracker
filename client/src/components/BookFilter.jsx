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

// Personal / Business switch inside a form; `both` adds a third option (used for categories).
export function BookSwitch({ value, onChange, both = false }) {
  const options = both ? [...OPTIONS.slice(1), ['both', 'Both']] : OPTIONS.slice(1);
  return (
    <div className="type-toggle book-switch" role="group" aria-label="Book">
      {options.map(([v, label]) => (
        <button type="button" key={v} className={v === value ? 'active' : ''} aria-pressed={v === value} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}
