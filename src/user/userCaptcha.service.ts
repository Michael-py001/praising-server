import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from 'src/entities/account.entity';
import { UserInfo } from 'src/entities/userinfo.entity';
import { AccountLog } from 'src/entities/accountLog.entity';
import browserInit from 'src/libs/browserInit';
import { Frame, Page } from 'puppeteer';
import fetchUserInfo from 'src/libs/pageControl/fetchUserInfo';
import { cookiesToString } from 'src/libs/cookie';
@Injectable()
export class UserCaptchaService {
  constructor(
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(UserInfo)
    private readonly userInfoRepository: Repository<UserInfo>,
    @InjectRepository(AccountLog)
    private readonly accountLogRepository: Repository<AccountLog>,
  ) {}

  // 计算滑块缺口X轴位置
  async getCaptchaX(frame: Frame) {
    await frame.waitForSelector('#captcha_verify_image');
    const captchaImage = await frame.$('#captcha_verify_image');
    console.log(captchaImage);
    const coordinateShift = await frame.evaluate(async () => {
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve(null);
        }, 1000);
      });
      const image = document.querySelector(
        '.verify-image>#captcha_verify_image',
      ) as HTMLCanvasElement;
      console.log(document);
      console.log('image', image);
      const ctx = image.getContext('2d');
      // 延时
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve(null);
        }, 1000);
      });

      // 将验证码底图绘制到画布上
      ctx.drawImage(image, 0, 0, image.width, image.height);
      // 获取画布上的像素数据
      const imageData = ctx.getImageData(0, 0, image.width, image.height);
      // 将像素数据转换为二维数组，处理灰度、二值化，将像素点转换为0（黑色）或1（白色）
      const data: number[][] = [];
      for (let h = 0; h < image.height; h++) {
        data.push([]);
        for (let w = 0; w < image.width; w++) {
          const index = (h * image.width + w) * 4;
          const r = imageData.data[index] * 0.2126;
          const g = imageData.data[index + 1] * 0.7152;
          const b = imageData.data[index + 2] * 0.0722;
          if (r + g + b > 100) {
            data[h].push(1);
          } else {
            data[h].push(0);
          }
        }
      }
      // 计算每一列黑白色像素点相邻的个数，找到最多的一列，大概率为缺口位置 有给掘金文章刷赞的方法吗，我这没人看啊
      let maxChangeCount = 0;
      let coordinateShift = 0;
      for (let w = 0; w < image.width; w++) {
        let changeCount = 0;
        for (let h = 0; h < image.height; h++) {
          if (data[h][w] == 0 && data[h][w - 1] == 1) {
            changeCount++;
          }
        }
        if (changeCount > maxChangeCount) {
          maxChangeCount = changeCount;
          coordinateShift = w;
        }
      }
      return coordinateShift;
    });
    return coordinateShift * 0.625;
  }
  // 处理滑块逻辑
  async handleDrag(page: Page, frame: Frame) {
    function easeOutBounce(t: number, b: number, c: number, d: number) {
      if ((t /= d) < 1 / 2.75) {
        return c * (7.5625 * t * t) + b;
      } else if (t < 2 / 2.75) {
        return c * (7.5625 * (t -= 1.5 / 2.75) * t + 0.75) + b;
      } else if (t < 2.5 / 2.75) {
        return c * (7.5625 * (t -= 2.25 / 2.75) * t + 0.9375) + b;
      } else {
        return c * (7.5625 * (t -= 2.625 / 2.75) * t + 0.984375) + b;
      }
    }
    // 在浏览器中执行代码，获取图片，创建canvas
    const coordinateShift = await this.getCaptchaX(frame);
    console.log(coordinateShift);
    if (coordinateShift) {
      await frame.waitForSelector('.captcha-slider-btn');
      const drag = await frame.$('.captcha-slider-btn');
      console.log(drag);
      const dragBox = await drag.boundingBox();
      const dragX = dragBox.x + dragBox.width / 2;
      const dragY = dragBox.y + dragBox.height / 2;
      console.log(dragX, dragY);

      await page.mouse.move(dragX, dragY);
      await page.mouse.down();
      await page.waitForTimeout(300);

      // 定义每个步骤的时间和总时间
      const totalSteps = 100;
      const stepTime = 5;

      for (let i = 0; i <= totalSteps; i++) {
        const t = i / totalSteps; // 当前步骤占总时间的比例
        const easeT = easeOutBounce(t, 0, 1, 1); // 使用easeOutBounce函数计算当前位置占总距离的比例

        const newX = dragX + coordinateShift * easeT - 5;
        const newY = dragY + Math.random() * 10;

        await page.mouse.move(newX, newY, { steps: 1 });
        await page.waitForTimeout(stepTime);
      }

      await page.waitForTimeout(800);
      await page.mouse.up();
    }
    try {
      console.log('滑块验证成功，等待页面跳转');
      // 等待页面跳转
      await page.waitForNavigation();
      console.log('登录成功');
    } catch (error) {
      console.log('登录失败');
      throw new Error('登录失败');
    }
  }

  // 通过密码登录
  async loginWithPassword(account: string, password: string, shareId?: string) {
    console.log('登录', account, password, shareId);
    const { page, destroy } = await browserInit('new', true);
    await page.goto('https://juejin.cn/login');
    await page.waitForSelector('.other-login-box .clickable');
    await page.click('.other-login-box .clickable');
    await page.waitForSelector('.input-group input[name="loginPhoneOrEmail"]');
    await page.type('.input-group input[name="loginPhoneOrEmail"]', account);
    await page.type('.input-group input[name="loginPassword"]', password);
    await page.click('.btn-login');
    // 等待 .vc_captcha_wrapper 下的 iframe 加载完成
    await page.waitForSelector('iframe');
    // 获取 iframe
    const elementHandle = await page.$('iframe');
    // 获取 iframe 的 contentWindow
    const frame = await elementHandle.contentFrame();
    try {
      await this.handleDrag(page, frame);
    } catch (error) {
      console.log(error);
      destroy();
      throw new Error('滑块验证失败，请重试');
    }
    // 获取 cookie
    const userInfoData = await fetchUserInfo(page);
    if (!userInfoData) {
      destroy();
      throw new Error('用户信息获取失败，请重试');
    }
    const { username, userId, starNumber, articleInfo, pinInfo, avatar } =
      userInfoData;
    // userinfo 库 查询是否存在 userId
    const hasUser = await this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.userInfo', 'userInfo')
      .where('userInfo.userId = :userId', { userId })
      .getOne();
    const cookies = await page.cookies();
    const cookie = cookiesToString(cookies);

    const userInfo = {
      username,
      userId,
      avatar,
      contribution: 0,
      userArticleLike: starNumber[0],
      userPinLike: starNumber[1],
      totalArticle: articleInfo[0],
      articleShow: articleInfo[1],
      articleRead: articleInfo[2],
      articleLike: articleInfo[3],
      articleComment: articleInfo[4],
      articleCollect: articleInfo[5],
      totalPin: pinInfo[0],
      totalPinLike: pinInfo[1],
      totalPinComment: pinInfo[2],
    };

    if (hasUser) {
      await this.accountRepository.update(
        { id: hasUser.id },
        { cookie, account, password },
      );
    } else {
      if (shareId) {
        userInfo.contribution += 500;
        const sharedUser = await this.accountRepository
          .createQueryBuilder('account')
          .leftJoinAndSelect('account.userInfo', 'userInfo')
          .where('userInfo.userId = :userId', { userId: shareId })
          .getOne();
        if (sharedUser) {
          sharedUser.userInfo.contribution += 500;
          await this.userInfoRepository.save(sharedUser.userInfo);
        }
      }
      await this.accountRepository.save({
        cookie,
        account,
        password,
        userInfo,
      });
    }

    destroy();
    return {
      username,
      userId,
      starNumber,
      articleInfo,
      pinInfo,
      avatar,
      cookie,
    };
  }
}
