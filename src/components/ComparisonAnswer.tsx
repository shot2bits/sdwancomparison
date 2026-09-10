import { Fragment, type ReactNode } from 'react';

// Render the supported answer format as React elements. Never interpret raw HTML.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2,-2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1,-1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link && /^https?:\/\//i.test(link[2])) return <a key={i} className="underline" href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
export default function ComparisonAnswer({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split(/\r?\n/);
  for(let i=0;i<lines.length;i++) {
    const line=lines[i].trim(); if(!line || /^[-*_]{3,}$/.test(line)) continue;
    if(/^#{1,6}\s+/.test(line)) { blocks.push(<h3 key={i} className="mt-5 font-semibold">{inline(line.replace(/^#{1,6}\s+/,''))}</h3>);continue; }
    if(/^(?:[-*+] |\d+\. )/.test(line)) {
      const start=i, numbered=/^\d+\./.test(line), items=[];
      while(i<lines.length && (numbered ? /^\d+\.\s+/ : /^[-*+]\s+/).test(lines[i].trim())) {items.push(<li key={i}>{inline(lines[i].trim().replace(/^(?:[-*+]|\d+\.)\s+/,''))}</li>);i++;} i--;
      blocks.push(numbered?<ol key={start} className="ml-5 list-decimal space-y-2">{items}</ol>:<ul key={start} className="ml-5 list-disc space-y-2">{items}</ul>);continue;
    }
    blocks.push(<p key={i} className="my-2 leading-6">{inline(line)}</p>);
  }
  return <div className="mt-4 text-sm" role="status">{blocks}</div>;
}
