import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SafeMarkdown } from "../src/core/features/markdown/ui/markdown";

const render = (text: string) =>
  renderToStaticMarkup(<SafeMarkdown>{text}</SafeMarkdown>);

it("ISSUE-001 ISSUE-008 ISSUE-025 ISSUE-026 BASE-INPUT-002 safe Markdown display", () => {
  // "renders headings, emphasis, lists, blockquotes, and literal code"
  {
    const html = render(
      "# Evidence\n\n**Bold** and *emphasis*\n\n- One\n- Two\n\n> Quoted\n\n`<script>alert(1)</script>`\n\n```js\nconst answer = 42\n```",
    );
    expect(html).toContain("<h1>Evidence</h1>");
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<em>emphasis</em>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>Two</li>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain(
      "<code>&lt;script&gt;alert(1)&lt;/script&gt;</code>",
    );
    expect(html).toContain('<pre><code class="language-js">');
    expect(html).toContain('class="hljs-keyword">const</span>');
    expect(html).toContain('class="hljs-number">42</span>');
  }
  {
    const html = render("~~Old~~\n\n| Step | Result |\n| --- | --- |\n| Repro | Fixed |\n\n- [ ] Repro on iOS\n- [x] Add regression coverage\n\n:::details Investigation\n\nEvidence kept here.\n\n:::");
    expect(html).toContain("<del>Old</del>");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>Fixed</td>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('aria-label="Repro on iOS"');
    expect(html).toContain('disabled=""');
    expect(html).toContain("<details><summary>Investigation</summary>");
  }
  // "does not render supplied script, form, frame, SVG, event handler, or raw tracking HTML"
  {
    const html = render(
      'Before\n\n<script>alert(1)</script>\n\n<form action="https://evil.test"><input name="secret" /></form>\n\n<iframe src="https://evil.test"></iframe>\n\n<svg onload="alert(1)"></svg>\n\n<img src="https://tracker.test/pixel" onerror="alert(1)">\n\nAfter',
    );
    expect(html).toContain("Before");
    expect(html).toContain("After");
    expect(html).not.toMatch(/<(?:script|form|input|iframe|svg|img)\b/i);
    expect(html).not.toMatch(
      /on(?:error|load)=|tracker\.test|evil\.test|alert\(1\)/i,
    );
  }
  // "keeps a named HTTPS link safe without passing the document referrer"
  {
    expect(
      render(
        '[Customer evidence](https://evidence.example/report?case=42 "Source")',
      ),
    ).toContain(
      '<a href="https://evidence.example/report?case=42" title="Source" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Customer evidence</a>',
    );
  }
  // "permits the reviewed internal document target %s"
  for (const url of [
    "/app",
    "/app/current/FLW-842",
    "/app/my-work/FLW-842",
    "/app/issues/FLW-842",
    "/app/projects/project-1",
    "/app/new-issue",
    "#evidence",
  ]) {
    const html = render(`[Open](${url})`);
    expect(html).toContain(`href="${url}"`);
    expect(html).not.toContain('target="_blank"');
  }
  // "renders an unsafe link as inert text: %s"
  for (const url of [
    "javascript:alert%281%29",
    "JaVaScRiPt:alert%281%29",
    "java&#x73;cript:alert%281%29",
    "javascript&#58;alert%281%29",
    "java%0ascript:alert%281%29",
    "java\u0001script:alert%281%29",
    "data:text/html;base64,PHNjcmlwdD4=",
    "file:///etc/passwd",
    "vbscript:msgbox%281%29",
    "http://insecure.example/",
    "//external.example/",
    "https://user:secret@example.test/",
    "https://example.test/%0aheader",
    "https://example.test/%7f",
    "https://example.test/\\evil",
    "/auth/signout",
    "/api/issues",
    "/_serverFn/example",
    "/app/../auth/signout",
    "/app/%2e%2e/auth/signout",
    "/app/%2f%2fexternal.example",
    "/app/%00",
  ]) {
    const html = render(`[Visible label](${url})`);
    expect(html).toContain("Visible label");
    expect(html).not.toMatch(/<a\b|href=/i);
  }
  // "makes a remote Markdown tracking image an accessible explicit load request"
  {
    const html = render(
      '![Customer screenshot](https://tracker.test/pixel?case=42 "Evidence")',
    );
    expect(html).toContain(
      '<button type="button">Load image: Customer screenshot</button>',
    );
    expect(html).not.toMatch(/<img\b|<link\b|src=|tracker\.test|pixel/i);
  }
  // "escapes an image label rather than treating it as HTML"
  {
    const html = render(
      "![<script>alert(1)</script>](https://images.example/evidence.png)",
    );
    expect(html).toContain("Load image: &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toMatch(/<script\b|<img\b/);
  }
  // "keeps a linked image load control outside the navigation anchor"
  {
    const html = render(
      "[![Evidence](https://images.example/evidence.png)](https://evidence.example/report)",
    );
    expect(html).toContain(
      '<button type="button">Load image: Evidence</button>',
    );
    expect(html).toContain('href="https://evidence.example/report"');
    expect(html).toContain(">Open linked page</a>");
    expect(html).not.toMatch(/<a\b[^>]*>[^<]*<[^>]*button|<img\b|src=/);
  }
  // "renders an unsafe image without a load action or source: %s"
  for (const url of [
    "javascript:alert%281%29",
    "java&#x73;cript:alert%281%29",
    "data:image/svg+xml,evil",
    "http://tracker.test/pixel",
    "//tracker.test/pixel",
    "file:///private/secret",
    "/api/issues/FLW-842/files/secret",
    "https://images.test/%0dimage",
  ]) {
    const html = render(`![Evidence](${url})`);
    expect(html).toContain("Evidence");
    expect(html).not.toMatch(/<img\b|src=|<button\b|<link\b/);
  }
});

it("ISSUE-013 safe readable canonical mentions", () => {
  const renderMention = (text: string) =>
    renderToStaticMarkup(
      <SafeMarkdown activeOperatorIds={["01ARZ3NDEKTSV4RRFFQ69G5FAV"]}>
        {text}
      </SafeMarkdown>,
    );

  const mention = "@{01ARZ3NDEKTSV4RRFFQ69G5FAV|Alice%20%3Cscript%3E}";
  // "renders selected names as escaped text after Markdown parsing"
  {
    const html = renderMention(`Hello ${mention}.`);
    expect(html).toContain("@Alice &lt;script&gt;");
    expect(html).not.toContain("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(html).not.toContain("<script>");
  }
  // "does not reinterpret code, link text, HTML, escapes, or email adjacency"
  {
    for (const body of [
      `\`${mention}\``,
      `[${mention}](https://example.test)`,
      `\\${mention}`,
      `email${mention}`,
      `<span>${mention}</span>`,
    ]) {
      expect(renderMention(body)).not.toContain("@Alice &lt;script&gt;");
    }
    expect(renderMention(`\`\`\`\n${mention}\n\`\`\``)).toContain(
      "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    );
  }
  // "keeps an identical escaped or entity-created mention literal before a selected mention"
  {
    for (const literal of [`\\${mention}`, mention.replace("@", "&#64;")]) {
      const html = renderMention(`${literal} then ${mention}`);
      expect(html.match(/01ARZ3NDEKTSV4RRFFQ69G5FAV/g)).toHaveLength(1);
      expect(html.match(/@Alice &lt;script&gt;/g)).toHaveLength(1);
    }
  }
  // "keeps image loading explicit when mentions occur nearby"
  {
    const html = renderMention(
      `${mention}\n\n![Evidence](https://example.test/pixel.png)`,
    );
    expect(html).toContain("Load image: Evidence");
    expect(html).not.toContain("<img");
  }

  // Unknown canonical identity remains literal.
  {
    const mention = "@{01ARZ3NDEKTSV4RRFFQ69G5FAV|Alice%20Smith}";
    expect(render(mention)).toContain(mention);
  }
});
