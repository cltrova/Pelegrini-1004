/**
 * Build a compact pagination window: [1, '...', current-1, current, current+1, '...', last]
 * Always shows first & last. Returns array of numbers and '...' strings.
 */
export function buildPageWindow(current: number, total: number, siblings = 1): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const first = 0;
  const last = total - 1;
  const left = Math.max(first + 1, current - siblings);
  const right = Math.min(last - 1, current + siblings);

  const showLeftDots = left > first + 1;
  const showRightDots = right < last - 1;

  const pages: (number | '...')[] = [first];
  if (showLeftDots) pages.push('...');
  else for (let i = first + 1; i < left; i++) pages.push(i);

  for (let i = left; i <= right; i++) pages.push(i);

  if (showRightDots) pages.push('...');
  else for (let i = right + 1; i < last; i++) pages.push(i);

  pages.push(last);
  return pages;
}
