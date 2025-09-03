// @ts-nocheck
import type { Page, Request, Route } from '@playwright/test';

export type SseScript = Array<string>;

export function mockSSE(page: Page, urlPart: string | RegExp, script: SseScript) {
  return page.route(urlPart, async (route: Route, req: Request) => {
    const headers = { 'content-type': 'text/event-stream; charset=utf-8' };
    await route.fulfill({
      status: 200,
      headers,
      body: [
        'event: open\n\n',
        ...script.map(line => `data: ${line}\n\n`),
        'data: [DONE]\n\n',
      ].join(''),
    });
  });
}

export function mockJSON(page: Page, urlPart: string | RegExp, data: any, status = 200) {
  return page.route(urlPart, async (route) => {
    await route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  });
}
