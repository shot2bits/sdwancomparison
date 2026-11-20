/** Lock the background without widening layouts when a classic scrollbar disappears. */
export function lockMenuScroll(doc: Document = document, view: Window = window): () => void {
  const style = doc.body.style;
  const previousOverflow = style.overflow;
  const previousPadding = style.paddingRight;
  const widthBefore = doc.documentElement.clientWidth;
  const paddingBefore = Number.parseFloat(view.getComputedStyle(doc.body).paddingRight) || 0;
  style.overflow = 'hidden';
  // Measure the real change: overlay scrollbars and reserved gutters need no padding.
  const widthChange = Math.max(0, doc.documentElement.clientWidth - widthBefore);
  if (widthChange > 0) style.paddingRight = `${paddingBefore + widthChange}px`;
  return () => {
    style.overflow = previousOverflow;
    style.paddingRight = previousPadding;
  };
}
