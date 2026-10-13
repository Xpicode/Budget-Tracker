import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { save, softDelete } from '../repo';
import Sheet from '../components/Sheet';

export default function Categories() {
  const [editing, setEditing] = useState(null); // null = closed, {} = new, row = edit
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.deleted_at).toArray()) ?? [];

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    await save('categories', {
      icon: null,
      ...editing,
      name: f.get('name').trim(),
      type: f.get('type'),
      color: f.get('color'),
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
        <button type="button" key={c.id} className="row" onClick={() => setEditing(c)}>
          <span className="row-main">
            <span><i className="swatch" style={{ background: c.color ?? '#9ca3af' }} />{c.name}</span>
          </span>
        </button>
      ))}
    </section>
  );

  return (
    <>
      <header className="month-bar"><h1>Categories</h1></header>

      {group('expense')}
      {group('income')}

      <button type="button" className="fab" onClick={() => setEditing({})} aria-label="Add category">+</button>

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
