// Fixed categorical order (colour-blind-safe set). A category keeps its colour as others come and go,
// and the same colour is used everywhere (chart slices, transaction avatars, category dots).
export const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

// { [category_id]: colour }: the colour the user picked, else by position in its group's name-sorted list.
// Groups are type + book, so the categories inside one chart (e.g. personal expenses) get distinct colours.
// 'both' categories appear next to either book, so they count down from the end of the palette.
// ponytail: more than 8 categories in one group repeat colours; pick colours in Categories if that happens.
export function categoryColors(categories) {
  const groups = {};
  for (const c of [...categories].sort((a, b) => a.name.localeCompare(b.name))) {
    (groups[`${c.type}:${c.book ?? 'both'}`] ??= []).push(c);
  }
  const colors = {};
  for (const [key, list] of Object.entries(groups)) {
    const fromEnd = key.endsWith(':both');
    list.forEach((c, i) => {
      colors[c.id] = c.color ?? PALETTE[(fromEnd ? PALETTE.length - 1 - i : i) % PALETTE.length];
    });
  }
  return colors;
}
