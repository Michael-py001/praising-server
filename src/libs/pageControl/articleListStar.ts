import { Page } from 'puppeteer';

// 文章列表页 点赞
export default async function articleListStar(page: Page) {
  try {
    await page.waitForSelector('.liked-wrap');
    const article = await page.$('.title-row a.title').then((res) => {
      return res.evaluate((node) => ({
        title: node.innerText,
        link: node.href,
      }));
    });
    await page.click('.liked-wrap');
    return article;
  } catch (error) {
    return false;
  }
}
