export type XmlJson<T extends string = string> = {
  [K in T]: string[];
};

export function xml2json<T extends string>(xml: string, tags: readonly T[]): XmlJson<T> {
  const parser = new LooseXmlParser(tags);
  parser.parse(xml);
  return parser.toJson();
}

type ElementFrame = {
  tag: string;
  text: string;
};

class LooseXmlParser<T extends string> {
  private readonly result: XmlJson<T> = {} as XmlJson<T>;
  private readonly tags: Set<string>;
  private readonly stack: ElementFrame[] = [];

  constructor(tags: readonly T[]) {
    this.tags = new Set(tags);
    for (const tag of tags) {
      this.result[tag] = [];
    }
  }

  parse(content: string): void {
    let index = 0;

    while (index < content.length) {
      const token = this.readTagToken(content, index);
      if (!token) break;

      this.text(content.slice(index, token.start));

      if (token.kind === "open") {
        this.startElement(token.tag);
      } else {
        this.endElement(token.tag);
      }

      index = token.end;
    }

    this.flushOpenElements();
  }

  toJson(): XmlJson<T> {
    return this.result;
  }

  private startElement(tag: string): void {
    const current = this.stack[this.stack.length - 1];
    if (current) {
      this.finishCurrentElement();
    }
    this.stack.push({ tag, text: "" });
  }

  private text(value: string): void {
    const current = this.stack[this.stack.length - 1];
    if (current) {
      current.text += this.stripKnownClosingTags(value);
    }
  }

  private endElement(tag: string): void {
    const current = this.stack[this.stack.length - 1];
    if (current?.tag === tag) {
      this.finishCurrentElement();
    }
  }

  private finishCurrentElement(): void {
    const current = this.stack.pop();
    if (!current) return;
    const values = this.result[current.tag as T];
    if (values) values.push(current.text.trim());
  }

  private flushOpenElements(): void {
    while (this.stack.length > 0) {
      this.finishCurrentElement();
    }
  }

  private readTagToken(content: string, from: number): TagToken | null {
    for (let i = from; i < content.length; i++) {
      if (content[i] !== "<") continue;
      const end = content.indexOf(">", i + 1);
      if (end === -1) return null;
      const rawTag = content.slice(i + 1, end).trim();
      const kind = rawTag.startsWith("/") ? "close" : "open";
      const tag = kind === "close" ? rawTag.slice(1).trim() : rawTag;
      if (this.tags.has(tag)) return { kind, tag, start: i, end: end + 1 };
    }

    return null;
  }

  private stripKnownClosingTags(content: string): string {
    const pattern = [...this.tags].map(escapeRegExp).join("|");
    if (!pattern) return content;
    return content.replace(new RegExp(`</(${pattern})>`, "g"), "");
  }
}

type TagToken = {
  kind: "open" | "close";
  tag: string;
  start: number;
  end: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
