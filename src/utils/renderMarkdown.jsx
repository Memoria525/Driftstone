// Lightweight markdown renderer for card explanations.
// Supports: ## headings, **bold**, \n- lists, inline newlines.

function inlineMarkdown(text) {
  const parts = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export default function renderMarkdown(md) {
  if (!md) return null;

  const lines = md.split('\n');
  const elements = [];
  let listItems = [];
  let key = 0;

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc pl-5 space-y-1">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm text-[--color-text]">{inlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flushList();
      continue;
    }

    // Horizontal rule: --- (or more dashes)
    if (/^-{3,}$/.test(trimmed)) {
      flushList();
      elements.push(<hr key={key++} className="border-[--color-border]" />);
      continue;
    }

    // Heading: # Text (top level)
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <p key={key++} className="text-base font-bold text-[--color-text]">
          {inlineMarkdown(trimmed.slice(2))}
        </p>
      );
      continue;
    }

    // Heading: ## Text (and deeper — rendered the same)
    if (trimmed.startsWith('## ')) {
      flushList();
      const text = trimmed.replace(/^#{2,6}\s+/, '');
      elements.push(
        <p key={key++} className="text-sm font-semibold text-[--color-text]">
          {inlineMarkdown(text)}
        </p>
      );
      continue;
    }

    // List item: - Text or 1. Text
    const listMatch = trimmed.match(/^[-*]\s+(.+)/) || trimmed.match(/^\d+\.\s+(.+)/);
    if (listMatch) {
      listItems.push(listMatch[1]);
      continue;
    }

    // Plain text
    flushList();
    elements.push(
      <p key={key++} className="text-sm text-[--color-text]">{inlineMarkdown(trimmed)}</p>
    );
  }

  flushList();
  return elements;
}
