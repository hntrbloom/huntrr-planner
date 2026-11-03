// Presentation-only defaults. Custom colours saved with records remain intact.
export function getGrayscalePalette(count: number) {
  const surfaces = ['var(--pink-pale)', 'var(--pink-blush)', 'var(--white)', 'var(--pink-soft)', 'var(--black-light-gray)'];
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    bg: surfaces[index % surfaces.length],
    text: 'var(--black-near)',
  }));
}
