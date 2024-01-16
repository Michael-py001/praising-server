import puppeteer from 'puppeteer';

// 统一的浏览器初始化
export default async function browserInit(
  browserHeadless: 'new' | false = 'new',
  imagesEnabled = false,
) {
  const browser = await puppeteer.launch({
    headless: browserHeadless,
    defaultViewport: {
      width: 1200,
      height: 800,
    },
    args: [
      '--no-sandbox',
      '--disable-web-security',
      `--blink-settings=imagesEnabled=${imagesEnabled}`,
      `--window-size=1600,800`,
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--allow-running-insecure-content',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
    ],
    devtools: true,
  });
  const page = await browser.newPage();

  const timeout = 6 * 60 * 60 * 1000; // 6 hour in milliseconds
  const timeoout = setTimeout(() => {
    browser.close();
  }, timeout);

  function destroy() {
    if (timeoout) {
      clearTimeout(timeoout);
    }
    browser.close();
  }

  return {
    page,
    destroy,
  };
}
