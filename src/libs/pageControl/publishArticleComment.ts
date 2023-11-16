import { Page } from 'puppeteer';

// 文章页编辑与发布评论
export default async function articlePublishComment(
  page: Page,
  comment: string,
) {
  try {
    await page.waitForSelector('.rich-input');
    await page.type('.rich-input', comment);
    await page.waitForSelector('.submit .submit-btn');
    await page.waitForTimeout(1000);
    await page.click('.submit .submit-btn');
    await page.waitForTimeout(1000);
    return true;
  } catch (error) {
    return false;
  }
}
