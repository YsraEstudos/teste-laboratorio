import { expect, test as base } from '@playwright/test';

const GOOGLE_FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function isLocalRequest(url) {
  return LOCAL_HOSTS.has(hostnameOf(url));
}

/**
 * Every test automatically:
 * - keeps Google Fonts off the network;
 * - fails on uncaught browser errors and console.error;
 * - fails when a local asset/request is aborted or returns an error response.
 */
export const test = base.extend({
  expectedRuntimeIssues: [[], { option: true }],
  runtimeGuard: [
    async ({ page, expectedRuntimeIssues }, use) => {
      const issues = [];

      await page.route('**/*', async (route) => {
        const host = hostnameOf(route.request().url());

        if (!GOOGLE_FONT_HOSTS.has(host)) {
          await route.continue();
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: host === 'fonts.googleapis.com' ? 'text/css' : 'application/octet-stream',
          body: '',
        });
      });

      const onPageError = (error) => {
        issues.push(`pageerror: ${error.stack ?? error.message}`);
      };
      const onConsole = (message) => {
        if (message.type() === 'error') {
          issues.push(`console.error: ${message.text()}`);
        }
      };
      const onRequestFailed = (request) => {
        if (isLocalRequest(request.url())) {
          issues.push(
            `local request failed: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? 'unknown error'})`,
          );
        }
      };
      const onResponse = (response) => {
        if (isLocalRequest(response.url()) && response.status() >= 400) {
          issues.push(`local response error: ${response.status()} ${response.request().method()} ${response.url()}`);
        }
      };

      page.on('pageerror', onPageError);
      page.on('console', onConsole);
      page.on('requestfailed', onRequestFailed);
      page.on('response', onResponse);

      await use();

      expect(issues, `Runtime guard found browser errors:\n${issues.join('\n')}`).toEqual(expectedRuntimeIssues);
    },
    { auto: true },
  ],
});

export { expect };
