export function parseRss(xml, source) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const tag = (s, t) => {
    const m = s.match(new RegExp(`<${t}>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?</${t}>`));
    return m ? m[1].trim() : '';
  };
  return items.map((it, i) => ({
    source, title: tag(it, 'title'), url: tag(it, 'link'),
    strength: Math.max(0.1, 1 - i / Math.max(items.length, 1)),
  })).filter((s) => s.title);
}
