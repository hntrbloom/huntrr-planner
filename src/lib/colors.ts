// Presentation-only defaults. Custom colours saved with records remain intact.
export function lightSurfaceColor(value: string | undefined, fallback = '#FCE4EF') {
  if (!value) return fallback;
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (!match) return fallback;
  const hex = match[1].length === 3 ? [...match[1]].map(c => c + c).join('') : match[1];
  const [r, g, b] = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 >= 0.75 ? value : fallback;
}

export function getGrayscalePalette(count: number) {
  const surfaces = ['var(--pink-pale)', 'var(--pink-blush)', 'var(--white)', 'var(--pink-soft)', 'var(--black-light-gray)'];
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    bg: surfaces[index % surfaces.length],
    text: 'var(--black-near)',
  }));
}
