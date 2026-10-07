import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SafeMarkdown } from "../src/core/features/markdown/ui/markdown";

const render = (text: string) =>
  renderToStaticMarkup(<SafeMarkdown>{text}</SafeMarkdown>);

describe("ISSUE-001 ISSUE-008 BASE-INPUT-002 safe CommonMark display", () => {
  it("renders headings, emphasis, lists, blockquotes, and literal code", () => {
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
    expect(html).toContain('<pre><code class="language-js">const answer = 42');
  });

  it("does not render supplied script, form, frame, SVG, event handler, or raw tracking HTML", () => {
    const html = render(
      'Before\n\n<script>alert(1)</script>\n\n<form action="https://evil.test"><input name="secret" /></form>\n\n<iframe src="https://evil.test"></iframe>\n\n<svg onload="alert(1)"></svg>\n\n<img src="https://tracker.test/pixel" onerror="alert(1)">\n\nAfter',
    );
    expect(html).toContain("Before");
    expect(html).toContain("After");
    expect(html).not.toMatch(/<(?:script|form|input|iframe|svg|img)\b/i);
    expect(html).not.toMatch(
      /on(?:error|load)=|tracker\.test|evil\.test|alert\(1\)/i,
    );
  });

  it("keeps a named HTTPS link safe without passing the document referrer", () => {
    expect(
      render(
        '[Customer evidence](https://evidence.example/report?case=42 "Source")',
      ),
    ).toContain(
      '<a href="https://evidence.example/report?case=42" title="Source" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Customer evidence</a>',
    );
  });

  it.each([
    "/app",
    "/app/current/FLW-842",
    "/app/my-work/FLW-842",
    "/app/issues/FLW-842",
    "/app/projects/project-1",
    "/app/new-issue",
    "#evidence",
  ])("permits the reviewed internal document target %s", (url) => {
    const html = render(`[Open](${url})`);
    expect(html).toContain(`href="${url}"`);
    expect(html).not.toContain('target="_blank"');
  });

  it.each([
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
  ])("renders an unsafe link as inert text: %s", (url) => {
    const html = render(`[Visible label](${url})`);
    expect(html).toContain("Visible label");
    expect(html).not.toMatch(/<a\b|href=/i);
  });

  it("makes a remote Markdown tracking image an accessible explicit load request", () => {
    const html = render(
      '![Customer screenshot](https://tracker.test/pixel?case=42 "Evidence")',
    );
    expect(html).toContain(
      '<button type="button">Load image: Customer screenshot</button>',
    );
    expect(html).not.toMatch(/<img\b|<link\b|src=|tracker\.test|pixel/i);
  });

  it("escapes an image label rather than treating it as HTML", () => {
    const html = render(
      "![<script>alert(1)</script>](https://images.example/evidence.png)",
    );
    expect(html).toContain("Load image: &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toMatch(/<script\b|<img\b/);
  });

  it("keeps a linked image load control outside the navigation anchor", () => {
    const html = render(
      "[![Evidence](https://images.example/evidence.png)](https://evidence.example/report)",
    );
    expect(html).toContain(
      '<button type="button">Load image: Evidence</button>',
    );
    expect(html).toContain('href="https://evidence.example/report"');
    expect(html).toContain(">Open linked page</a>");
    expect(html).not.toMatch(/<a\b[^>]*>[^<]*<[^>]*button|<img\b|src=/);
  });

  it.each([
    "javascript:alert%281%29",
    "java&#x73;cript:alert%281%29",
    "data:image/svg+xml,evil",
    "http://tracker.test/pixel",
    "//tracker.test/pixel",
    "file:///private/secret",
    "/api/issues/FLW-842/files/secret",
    "https://images.test/%0dimage",
  ])("renders an unsafe image without a load action or source: %s", (url) => {
    const html = render(`![Evidence](${url})`);
    expect(html).toContain("Evidence");
    expect(html).not.toMatch(/<img\b|src=|<button\b|<link\b/);
  });
});
