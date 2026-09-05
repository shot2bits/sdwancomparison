/** VIC-20-style 8×8 lowercase glyphs, thickened one pixel horizontally.
 * Reference: https://techtinkering.com/articles/double-width-c64-style-font-on-the-commodore-vic-20/
 * The three custom glyphs are rendered as vectors; no font download is needed.
 */
const glyphs = [
  [0x00, 0x00, 0x3c, 0x22, 0x22, 0x22, 0x22, 0x00], // n
  [0x00, 0x00, 0x1c, 0x22, 0x3e, 0x20, 0x1e, 0x00], // e
  [0x10, 0x10, 0x3c, 0x10, 0x10, 0x12, 0x0c, 0x00], // t
];
const pixels = glyphs.flatMap((rows, letter) => rows.flatMap((row, y) => {
  const thick = (row | (row << 1)) & 0xff;
  return Array.from({ length: 8 }, (_, x) => (thick & (0x80 >> x)) ? `M${letter * 8 + x} ${y}h1v1h-1z` : '').filter(Boolean);
})).join('');
export default function NetifyWordmark() {
  return <span className="nf-era-wordmark" aria-hidden="true" style={{display:"inline-flex",alignItems:"baseline",whiteSpace:"nowrap",lineHeight:1,letterSpacing:0}}><svg className="nf-era-net" viewBox="0 0 24 8" focusable="false" style={{display:"inline-block",width:"2.4em",height:".8em",alignSelf:"center",shapeRendering:"crispEdges",marginRight:"-.08em"}}><path d={pixels} fill="currentColor" /></svg><span className="nf-era-ify" style={{fontFamily:"system-ui, sans-serif",fontWeight:750,letterSpacing:"-.065em"}}>ify</span><sup style={{position:"static",fontSize:".27em",alignSelf:"flex-start",margin:"2px 0 0 4px"}}>®</sup></span>;
}
