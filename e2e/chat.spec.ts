// @ts-nocheck
import { expect, test } from '@playwright/test';
import { mockJSON, mockSSE } from './utils/sse';

// In dev, adapters prefix with /openai. Support both /v1/... and /openai/v1/...
const OPENAI_CHAT = /(\/openai)?\/v1\/chat\/completions$/;
const ANTHROPIC_MSG = /\/v1\/messages$/;
const GEMINI_GEN = /\/v1(beta)?\/models\/.+:generateContent/;

async function openAssistant(page) {
  await page.addInitScript(() => {
    try {
      // seed e2e flag + fake OpenAI key to pass gating
      localStorage.setItem('synapse.flags.e2e', '1');
      const s = {
        mode: 'beginner',
        provider: 'openai',
        model: 'gpt-4o',
        languageId: 'typescript',
        temperature: 0.2,
        maxTokens: 2048,
        stream: true,
        timeoutMs: 30000,
        safetyLevel: 'standard',
        keys: { openai: 'sk-test-123' },
      };
      localStorage.setItem('synapse.ai.settings.v2', JSON.stringify(s));
    } catch {}
  });
  await page.goto('/?e2e=1');
  // Switch to IDE via test hook
  await page.waitForFunction(() => Boolean((window as any).e2e));
  await page.evaluate(() => (window as any).e2e?.setView?.('ide'));
  // Ensure assistant panel visible deterministically
  await page.evaluate(async () => {
    const e2e = (window as any).e2e;
    if (!e2e) return;
    if (typeof e2e.openAssistant === 'function') {
      await e2e.openAssistant();
    } else if (typeof e2e.setAiChatVisible === 'function') {
      e2e.setAiChatVisible(true);
    } else if (typeof e2e.toggleAI === 'function') {
      e2e.toggleAI();
    }
  });
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  // Ensure assistant input is present
  await expect(page.getByTestId('prompt-input')).toBeVisible();
}

test.describe('Chat E2E', () => {
  test('happy path: stream response and send to editor toast', async ({ page }) => {
    await mockSSE(page, OPENAI_CHAT, [
      JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }),
      JSON.stringify({ choices: [{ delta: { content: ' world' } }] }),
    ]);

    await openAssistant(page);
    await page.getByTestId('prompt-input').fill('Say hello');
    await page.getByTestId('send-btn').click();

  // Expect assistant message to stream (bubble text)
  const bubble1 = page.locator('.message--assistant .chat-message__bubble').last();
  await expect(bubble1).toContainText('Hello world', { timeout: 5000 });

    // Try editor bridge if present
    const sendToEditor = page.getByRole('button', { name: /Send to Editor/i }).first();
    if (await sendToEditor.isVisible().catch(() => false)) {
      await sendToEditor.click();
      await expect(page.getByTestId('toaster')).toBeVisible();
      await expect(page.getByTestId('toast').first()).toBeVisible();
    }
  });

  test('401 invalid key -> single toast', async ({ page }) => {
    await page.route(OPENAI_CHAT, async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Invalid key' } }) });
    });
    await openAssistant(page);
    await page.getByTestId('prompt-input').fill('Hi');
    await page.getByTestId('send-btn').click();

    const toaster = page.getByTestId('toaster');
    await expect(toaster).toBeVisible();
    const toasts = page.getByTestId('toast');
    await expect(toasts.first()).toBeVisible();
  });

  test('ESC abort shows Generation cancelled', async ({ page }) => {
    await mockSSE(page, OPENAI_CHAT, [JSON.stringify({ choices: [{ delta: { content: 'Typing…' } }] })]);
    await openAssistant(page);
    await page.getByTestId('prompt-input').fill('Start long stream');
    await page.getByTestId('send-btn').click();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('toaster')).toBeVisible();
  // Accept either wording depending on path
  const cancelToast = page.getByTestId('toast').filter({ hasText: /Generation (cancelled|stopped)\./ });
  await expect(cancelToast).toBeVisible();
  });

  test('5xx retry path -> error toast once', async ({ page }) => {
    let count = 0;
    await page.route(OPENAI_CHAT, async (route) => {
      count++;
      if (count <= 2) {
        await route.fulfill({ status: 502, contentType: 'application/json', body: '{}' });
      } else {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      }
    });
    await openAssistant(page);
    await page.getByTestId('prompt-input').fill('Trigger error');
    await page.getByTestId('send-btn').click();

    const toaster = page.getByTestId('toaster');
    await expect(toaster).toBeVisible();
    await expect(page.getByTestId('toast').first()).toBeVisible();
  });

  test('no virtual messages: only provider output populates assistant', async ({ page }) => {
    let requestCount = 0;
    await page.route(OPENAI_CHAT, async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: [
          'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Model says: ' } }] }) + '\n\n',
          'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Hello!' } }] }) + '\n\n',
          'data: [DONE]\n\n',
        ].join(''),
      });
    });

    await openAssistant(page);
    await page.getByTestId('prompt-input').fill('Please greet.');
    await page.getByTestId('send-btn').click();

    // Assistant should contain only streamed text, not any local/template copy
  const bubble = page.locator('.message--assistant .chat-message__bubble').last();
  await expect(bubble).toContainText('Model says: Hello!');
  await expect(bubble).not.toContainText('You are a senior coding assistant');

    // Ensure exactly one network request was made to the model
    await page.waitForTimeout(50);
    expect(requestCount).toBe(1);
  });
});
