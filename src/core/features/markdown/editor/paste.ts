import type { ClipboardEvent } from "react";
import { linkCommand, type MarkdownChange, type Selection } from "./commands";
/** The editor never fetches pasted resources or carries HTML into stored Markdown. */
export function safeEditorLink(value: string): boolean {
  if (/[\s\u0000-\u001f\u007f-\u009f\\()<>]/u.test(value)) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return false;
  }
  if (/[\s\u0000-\u001f\u007f-\u009f\\]/u.test(decoded)) return false;
  if (value.startsWith("#")) return true;
  if (/^\/app\/issues\/[A-Za-z0-9_-]+$/.test(value)) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}\[\]<>~|])/g, "\\$1")
    .replace(/(^|\n)([ \t]*)([>#]|[-+] |\d+\. )/g, "$1$2\\$3");
}
function fence(value: string, block = false) {
  const longest = Math.max(
    block ? 2 : 0,
    ...Array.from(value.matchAll(/`+/g), (match) => match[0].length),
  );
  return "`".repeat(longest + 1);
}

export function htmlToMarkdown(html: string): string {
  // Template content is inert, including images and embedded documents.
  const template = document.createElement("template");
  template.innerHTML = html;
  const dropped = new Set([
    "SCRIPT",
    "STYLE",
    "FORM",
    "INPUT",
    "BUTTON",
    "TEXTAREA",
    "SELECT",
    "OPTION",
    "IMG",
    "PICTURE",
    "SOURCE",
    "IFRAME",
    "OBJECT",
    "EMBED",
    "SVG",
    "MATH",
    "LINK",
    "META",
    "TEMPLATE",
    "NOSCRIPT",
  ]);
  const children = (node: Node): string =>
    Array.from(node.childNodes, (child) => visit(child)).join("");
  function list(element: Element, depth = 0): string {
    let number = Number(element.getAttribute("start")) || 1;
    return Array.from(element.children)
      .filter((child) => child.tagName === "LI")
      .map((item) => {
        const checkbox = item.querySelector(':scope > input[type="checkbox"]');
        const marker = checkbox
          ? `- [${checkbox.hasAttribute("checked") ? "x" : " "}] `
          : element.tagName === "OL"
            ? `${number++}. `
            : "- ";
        let content = "",
          nested = "";
        item.childNodes.forEach((child) => {
          if (child instanceof Element && ["UL", "OL"].includes(child.tagName))
            nested += list(child, depth + marker.length);
          else content += visit(child);
        });
        const indent = " ".repeat(depth);
        return (
          indent +
          marker +
          content
            .trim()
            .replace(/\n/g, "\n" + indent + " ".repeat(marker.length)) +
          "\n" +
          nested
        );
      })
      .join("");
  }
  function visit(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE)
      return escapeText((node.textContent ?? "").replace(/\s+/g, " "));
    if (
      !(node instanceof Element) ||
      dropped.has(node.tagName) ||
      node.hasAttribute("hidden") ||
      /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(
        node.getAttribute("style") ?? "",
      )
    )
      return "";
    const tag = node.tagName;
    if (tag === "PRE") {
      const code = node.querySelector("code");
      const value = (code ?? node).textContent ?? "";
      const language =
        /(?:^|\s)language-([\w+-]+)/.exec(code?.className ?? "")?.[1] ?? "";
      const delimiter = fence(value, true);
      return `\n\n${delimiter}${language}\n${value.replace(/\n$/, "")}\n${delimiter}\n\n`;
    }
    if (tag === "UL" || tag === "OL") return "\n\n" + list(node) + "\n";
    if (tag === "TABLE") {
      const rows = Array.from(node.querySelectorAll("tr"))
        .filter((row) => row.closest("table") === node)
        .map((row) =>
          Array.from(row.children)
            .filter((cell) => ["TH", "TD"].includes(cell.tagName))
            .map((cell) => children(cell).trim().replace(/\n+/g, " ")),
        );
      if (!rows.length) return "";
      const width = Math.max(...rows.map((row) => row.length));
      const row = (cells: string[]) =>
        "| " +
        Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ") +
        " |";
      return (
        "\n\n" +
        [
          row(rows[0]),
          row(Array(width).fill("---")),
          ...rows.slice(1).map(row),
        ].join("\n") +
        "\n\n"
      );
    }
    const content = children(node);
    if (/^H[1-6]$/.test(tag))
      return `\n\n${"#".repeat(Number(tag[1]))} ${content.trim()}\n\n`;
    if (["STRONG", "B"].includes(tag)) return `**${content.trim()}**`;
    if (["EM", "I"].includes(tag)) return `_${content.trim()}_`;
    if (["S", "STRIKE", "DEL"].includes(tag)) return `~~${content.trim()}~~`;
    if (tag === "CODE") {
      const value = node.textContent ?? "";
      const delimiter = fence(value);
      const pad =
        value.includes("`") || value.startsWith(" ") || value.endsWith(" ")
          ? " "
          : "";
      return delimiter + pad + value + pad + delimiter;
    }
    if (tag === "A") {
      const href = node.getAttribute("href") ?? "";
      return safeEditorLink(href) ? `[${content}](${href})` : content;
    }
    if (tag === "BLOCKQUOTE")
      return (
        "\n\n" +
        content
          .trim()
          .split("\n")
          .map((line) => "> " + line)
          .join("\n") +
        "\n\n"
      );
    if (tag === "HR") return "\n\n---\n\n";
    if (tag === "BR") return "\n";
    if (["P", "DIV", "SECTION", "ARTICLE"].includes(tag))
      return "\n\n" + content.trim() + "\n\n";
    return content;
  }
  return children(template.content).trim();
}

export function pasteMarkdown(
  event: ClipboardEvent<HTMLTextAreaElement>,
  {
    disabled,
    range,
    apply,
    setNotice,
  }: {
    disabled: boolean;
    range: () => Selection;
    apply: (change: MarkdownChange) => void;
    setNotice: (message: string) => void;
  },
) {
  if (disabled || event.defaultPrevented) return;
  if (event.clipboardData.files.length) {
    event.preventDefault();
    setNotice(
      "Use Attach file in the issue discussion to upload files or images.",
    );
    return;
  }
  const html = event.clipboardData.getData("text/html");
  if (!html) {
    const plain = event.clipboardData.getData("text/plain").trim();
    try {
      const url = new URL(plain, window.location.origin);
      const match = /^\/app\/issues\/([A-Za-z][A-Za-z0-9]*-\d+)$/.exec(
        url.pathname,
      );
      if (
        url.origin === window.location.origin &&
        match &&
        !url.search &&
        !url.hash
      ) {
        event.preventDefault();
        apply(linkCommand(range(), match[1], url.pathname));
      }
    } catch {
      /* Ordinary text uses the native paste operation. */
    }
    return;
  }
  event.preventDefault();
  const markdown = htmlToMarkdown(html);
  if (!markdown) {
    setNotice(
      "Pasted content contains no supported text. Use Attach file in the issue discussion for files or images.",
    );
    return;
  }
  const selection = range();
  apply({
    edits: [{ ...selection, text: markdown }],
    selection: {
      start: selection.start + markdown.length,
      end: selection.start + markdown.length,
    },
  });
}
