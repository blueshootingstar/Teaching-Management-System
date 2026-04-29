import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5173/login';
const username = process.env.STUDENT_USERNAME || '1102';
const password = process.env.STUDENT_PASSWORD || '123456';
const screenshotPath = path.join(__dirname, 'verify-student-chart-failure.png');

async function fail(page, message, extra = {}) {
  await mkdir(__dirname, { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const details = Object.keys(extra).length ? `\n${JSON.stringify(extra, null, 2)}` : '';
  throw new Error(`${message}${details}\n失败截图: ${screenshotPath}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('admin / 学号 / 教工号').fill(username);
  await page.getByPlaceholder('默认测试密码 123456').fill(password);
  const loginResponsePromise = page.waitForResponse((response) => (
    response.url().includes('/api/auth/login') && response.request().method() === 'POST'
  ), { timeout: 15000 });
  await page.locator('button[type="submit"]').click({ force: true });
  const loginResponse = await loginResponsePromise;
  if (!loginResponse.ok()) {
    await fail(page, '登录接口失败', {
      status: loginResponse.status(),
      body: await loginResponse.text()
    });
  }
  await page.waitForURL(/\/student$/, { timeout: 15000 });

  await page.getByRole('tab', { name: '个人成绩' }).click();
  await page.waitForSelector('.gpa-chart canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.gpa-chart canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const rect = canvas.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && canvas.width > 0 && canvas.height > 0;
  }, null, { timeout: 15000 });

  await page.waitForTimeout(1200);

  const result = await page.locator('.gpa-chart canvas').evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) {
      return { ok: false, reason: 'not-canvas' };
    }

    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext('2d');
    if (!context) {
      return { ok: false, reason: 'missing-2d-context', rect };
    }

    const width = canvas.width;
    const height = canvas.height;
    const pixels = context.getImageData(0, 0, width, height).data;
    let sampledPixels = 0;
    let nonBlankPixels = 0;

    for (let index = 0; index < pixels.length; index += 4 * 20) {
      sampledPixels += 1;
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];
      const isWhite = red > 245 && green > 245 && blue > 245;
      const isTransparent = alpha < 20;
      if (!isTransparent && !isWhite) {
        nonBlankPixels += 1;
      }
    }

    return {
      ok: rect.width > 0 && rect.height > 0 && width > 0 && height > 0 && nonBlankPixels > 80,
      cssWidth: rect.width,
      cssHeight: rect.height,
      width,
      height,
      sampledPixels,
      nonBlankPixels
    };
  });

  if (!result.ok) {
    await fail(page, '成绩图表 canvas 未通过非空像素验证', result);
  }

  console.log(JSON.stringify({
    status: 'passed',
    url: page.url(),
    username,
    chart: result
  }, null, 2));
} catch (error) {
  if (!page.isClosed()) {
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  }
  throw error;
} finally {
  await browser.close();
}
