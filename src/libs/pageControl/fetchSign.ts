import { Page } from 'puppeteer';

// 签到
export default async function fetchSign(page: Page) {
  await page.goto('https://juejin.cn/user/center/signin?from=main_page');
  try {
    const signinBtn = await page.$('.code-calender .signin.btn');
    if (signinBtn) {
      await signinBtn.click();
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}
