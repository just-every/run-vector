import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

// Serve the actual rer build --site output, without an installation or app API.
export async function serveSite(directory) {
  const root = resolve(directory);
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + pathname + (extname(pathname) ? '' : '/index.html'));
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    try {
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
      response.end(bytes);
    } catch { response.writeHead(404).end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
  };
}

export async function inspectHome(page) {
  const content = await page.locator('main').evaluate(main => {
    const sections = [...main.querySelectorAll('section')].filter(section => section.querySelector('h1,h2'));
    return {
      headline: main.querySelector('h1')?.textContent.trim(),
      sections: sections.map(section => ({
        heading: section.querySelector('h1,h2').textContent.trim(),
        paragraphs: [...section.querySelectorAll('p')].map(p => p.textContent.trim()).filter(Boolean),
      })),
      links: [...main.querySelectorAll('a[href]')].map(a => ({ href: a.getAttribute('href'), label: a.textContent.trim() })),
    };
  });
  assert.ok(content.headline, 'raw homepage has a headline');
  assert.ok(content.sections.length >= 6, 'raw homepage has at least six substantive sections');
  for (const section of content.sections) {
    assert.ok(section.heading && section.paragraphs.length, 'each section has a heading and supporting prose');
    assert.ok(section.paragraphs.some(p => p !== section.heading), 'support adds to its heading');
  }
  for (const destination of ['/run', '/docs', '/docs/install']) {
    assert.ok(content.links.some(link => link.href === destination && link.label), `homepage exposes the ${destination} action`);
  }
  assert.ok(await page.locator('header nav a[href^="https://github.com/"]').count(), 'navigation exposes public source');
  return content;
}

export async function visitPublicPage(browser, origin, path, inspect = async () => ({})) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const requests = [], responses = [], failures = [], errors = [];
  const pendingHeaders = [];
  // Observe and block forbidden requests before the browser can contact anyone.
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const forbidden = url.origin !== origin || /^\/(?:api|auth|_serverFn|__dev|setup)(?:\/|$)/.test(url.pathname);
    requests.push({ url: request.url(), type: request.resourceType(), forbidden });
    await (forbidden ? route.abort() : route.continue());
  });
  context.on('response', response => pendingHeaders.push((async () => {
    responses.push({ url: response.url(), status: response.status(), setCookie: (await response.headersArray()).some(header => header.name.toLowerCase() === 'set-cookie') });
  })()));
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failures.push(request.url()));
  page.on('websocket', socket => errors.push(`Unexpected WebSocket: ${socket.url()}`));
  try {
    const response = await page.goto(origin + path, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200, `${path} serves a public document`);
    // Trigger lazy images/frames and fonts below the fold as well as first paint.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
        scrollTo(0, y); await new Promise(resolve => requestAnimationFrame(resolve));
      }
      await document.fonts.ready;
    });
    await page.waitForLoadState('networkidle');
    const detail = await inspect(page);
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
    const frames = page.frames().map(frame => frame.url());
    await Promise.all(pendingHeaders);
    assert.deepEqual(requests.filter(request => request.forbidden), [], `${path}: no third-party loads or installation API calls`);
    assert.deepEqual(responses.filter(response => response.setCookie), [], `${path}: no Set-Cookie on any response`);
    assert.deepEqual(await context.cookies(), [], `${path}: fresh browser remains cookieless`);
    assert.deepEqual(resources.filter(url => new URL(url).origin !== origin), [], `${path}: only same-origin browser resources`);
    assert.deepEqual(frames.filter(url => url !== 'about:blank' && new URL(url).origin !== origin), [], `${path}: only same-origin frames`);
    assert.deepEqual(responses.filter(response => response.status >= 400), [], `${path}: resources load successfully`);
    assert.deepEqual(failures, [], `${path}: no failed loads`);
    assert.deepEqual(errors, [], `${path}: no browser errors`);
    return { path, requests: requests.length, responses: responses.length, resources: resources.length, frames: frames.length, ...detail };
  } finally { await context.close(); }
}
