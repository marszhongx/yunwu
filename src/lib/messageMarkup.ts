export type MessageMarkupNode = {
  type: "element";
  name: string;
  content: string;
};

const KNOWN_STREAMING_TAGS = ["content", "summary", "status", "choices"] as const;

export function normalizeMessageMarkup(source: string): string {
  return source.split("__LT__").join("<").split("__GT__").join(">");
}

export function parseMessageMarkup(source: string): MessageMarkupNode[] {
  const content = normalizeMessageMarkup(source);
  const nodes: MessageMarkupNode[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const match = findNextOpenTag(content, cursor);
    if (!match) break;
    if (nodes.length === 0) {
      pushContentNode(nodes, content.slice(cursor, match.index));
    }

    const name = match.name;
    const valueStart = match.end;
    const closingTag = `</${name}>`;
    const closingIndex = content.indexOf(closingTag, valueStart);
    const nextOpenTag = findNextOpenTag(content, valueStart);
    const closesBeforeNextTag =
      closingIndex !== -1 && (!nextOpenTag || closingIndex < nextOpenTag.index);

    if (closesBeforeNextTag) {
      pushElementNode(nodes, name, content.slice(valueStart, closingIndex));
      cursor = closingIndex + closingTag.length;
    } else {
      const valueEnd = nextOpenTag?.index ?? content.length;
      pushElementNode(nodes, name, content.slice(valueStart, valueEnd));
      cursor = valueEnd;
    }
  }

  if (nodes.length === 0) {
    pushContentNode(nodes, stripTrailingPartialKnownTag(content.slice(cursor)));
  }
  return nodes;
}

export function findMessageMarkupContent(
  nodes: MessageMarkupNode[],
  name: string,
): string | undefined {
  return nodes.find((node) => node.name === name)?.content;
}

function pushContentNode(nodes: MessageMarkupNode[], content: string): void {
  pushElementNode(nodes, "content", content);
}

function pushElementNode(nodes: MessageMarkupNode[], name: string, content: string): void {
  const value = content.trim();
  if (!value) return;
  nodes.push({ type: "element", name, content: value });
}

function findNextOpenTag(content: string, from: number) {
  const pattern = /<([A-Za-z][A-Za-z0-9_-]*)>/g;
  pattern.lastIndex = from;
  const match = pattern.exec(content);
  if (!match) return null;
  return {
    name: match[1],
    index: match.index,
    end: pattern.lastIndex,
  };
}

function stripTrailingPartialKnownTag(content: string): string {
  for (const tag of KNOWN_STREAMING_TAGS) {
    for (let length = 1; length < tag.length; length++) {
      const partial = `<${tag.slice(0, length)}`;
      if (content.endsWith(partial)) {
        return content.slice(0, -partial.length);
      }
    }
  }
  return content;
}
