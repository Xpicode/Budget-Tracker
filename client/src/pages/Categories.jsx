import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { save, softDelete } from '../repo';
import Sheet from '../components/Sheet';
import Icon from '../components/Icon';
import BookFilter, { BookSwitch } from '../components/BookFilter';
import { categoryFits } from '../reports';
import { categoryColors } from '../colors';
import { useBook } from '../settings';

const BOOK_LABEL = { personal: 'Personal', business: 'Business' }; // 'both' shows no tag

export default function Categories() {
  const view = useBook(); // the All / Personal / Business filter, shared with the other pages
  const [editing, setEditing] = useState(null); // null = closed, {} = new, row = edit
  const [book, setBook] = useState('personal');
  const all = useLiveQuery(() => db.categories.filter((c) => !c.deleted_at).sortBy('name')) ?? [];
  const categories = view === 'all' ? all : all.filter((c) => categoryFits(c, view));
  const colors = categoryColors(all); // same colours as the chart and transaction avatars

  function open(category) {
    // A new category starts in the book you're looking at.
    setBook(category.book ?? (view === 'all' ? 'personal' : view));
    setEditing(category);
  }

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    await save('categories', {
      icon: null,
      ...editing,
      name: f.get('name').trim(),
      type: f.get('type'),
      color: f.get('color'),
      book,
    });
    setEditing(null);
  }

  async function remove() {
    await softDelete('categories', editing.id);
    setEditing(null);
  }

  const group = (type) => (
    <section className="group" key={type}>
      <h2>{type}</h2>
      {categories.filter((c) => c.type === type).map((c) => (
        <button type="button" key={c.id} className="row" onClick={() => open(c)}>
          <span className="row-main">
            <span><i className="swatch" style={{ background: colors[c.id] }} />{c.name}</span>
          </span>
          {BOOK_LABEL[c.book] && <span className={`badge ${c.book}`}>{BOOK_LABEL[c.book]}</span>}
        </button>
      ))}
    </section>
  );

  return (
    <>
      <header className="month-bar"><h1>Categories</h1></header>
      <BookFilter />
      <p className="hint">A Business category is only offered for business transactions, a Personal one only for personal. "Both" is offered in either.</p>

      {group('expense')}
      {group('income')}

      <button type="button" className="fab" onClick={() => open({})} aria-label="Add category"><Icon name="plus" size={26} /></button>

      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <form onSubmit={submit}>
            <h2>{editing.id ? 'Edit' : 'Add'} category</h2>
            <label>
              Name
              <input name="name" required autoFocus defaultValue={editing.name ?? ''} />
            </label>
            <label>
              Type
              <select name="type" defaultValue={editing.type ?? 'expense'}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label>
              Used for
              <BookSwitch value={book} onChange={setBook} both />
            </label>
            <label>
              Color
              <input type="color" name="color" defaultValue={editing.color ?? '#2563eb'} />
            </label>
            <div className="actions">
              {editing.id && <button type="button" className="danger" onClick={remove}>Delete</button>}
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
