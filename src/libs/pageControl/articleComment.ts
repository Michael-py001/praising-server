import { Page } from 'puppeteer';
import publishArticleComment from './publishArticleComment';
import { Comment } from 'src/entities/comment.entity';

// 文章页评论
export default async function articleComment(page: Page, comments: Comment[]) {
  try {
    await page.waitForSelector('.entry-list');
    const article = await page.$$('.title-row a.title').then((res) => {
      // 随机获取一篇文章
      const random = Math.floor(Math.random() * res.length);
      return res[random].evaluate((node) => {
        return {
          title: node.innerText,
          href: node.href,
        };
      });
    });
    await page.goto(article.href);
    const comment = comments[Math.floor(Math.random() * comments.length)];
    const isPublish = await publishArticleComment(page, comment.content);
    if (!isPublish) return false;
    return {
      title: article.title,
      link: article.href,
      comment: comment.content,
      id: comment.id,
      useCount: comment.useCount,
    };
  } catch (error) {
    return false;
  }
}
