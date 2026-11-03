// Fixed categorical order (colour-blind-safe set). A category keeps its colour as others come and go,
// and the same colour is used everywhere (chart slices, transaction avatars).
export const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

// { [category_id]: colour }: the colour the user picked, else by position in the name-sorted list.
export function categoryColors(categories) {
  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  return Object.fromEntries(sorted.map((c, i) => [c.id, c.color ?? PALETTE[i % PALETTE.length]]));
}
