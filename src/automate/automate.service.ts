import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { AccountLog } from 'src/entities/accountLog.entity';
import { Account } from 'src/entities/account.entity';
import { Comment } from 'src/entities/comment.entity';
import { AccountService } from 'src/account/account.service';

import checkLoginState from 'src/libs/pageControl/checkLoginState';
import fetchFollow from 'src/libs/pageControl/fetchFollow';
import loopPages from 'src/libs/pageControl/loopPages';
import articleListStar from 'src/libs/pageControl/articleListStar';
import pinListStar from 'src/libs/pageControl/pinListStar';
import gotoWithRetries from 'src/libs/gotoWithRetries';
import articleComment from 'src/libs/pageControl/articleComment';
import publishPin from 'src/libs/pageControl/publishPin';
import {
  fetchArticle,
  fetchArticleList,
} from 'src/libs/pageControl/fetchArticleFromSegmentfault';
import publishArticle from 'src/libs/pageControl/publishArticle';
import fetchSign from 'src/libs/pageControl/fetchSign';
import { UserInfo } from 'src/entities/userinfo.entity';
import scrollToBottom from 'src/libs/scrollToBottom';
import { Pin } from 'src/entities/pin.entity';

@Injectable()
export class AutomateService {
  constructor(
    @InjectRepository(AccountLog)
    private accountLogsRepository: Repository<AccountLog>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(UserInfo)
    private userInfoRepository: Repository<UserInfo>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Pin)
    private pinRepository: Repository<Pin>,
    private schedulerRegistry: SchedulerRegistry,
    private accountService: AccountService,
  ) {}

  // 自动签到
  async autoSign() {
    const accounts = await this.accountService.getAccountInfo();
    await loopPages(accounts, async (page, index) => {
      await gotoWithRetries(page, 'https://juejin.cn/user/center/signin');
      const loginState = await checkLoginState(page);
      if (!loginState.state) return;
      const isSign = await fetchSign(page);
      if (isSign) {
        await this.accountLogsRepository.save({
          type: '账号',
          event: '签到',
          content: '掘金每日签到',
          record: '签到成功',
          account: accounts[index].id,
        });
      }
    });
  }

  // 自动关注
  async autoFollow() {
    const accounts = await this.accountService.getAccountInfo();
    await loopPages(accounts, async (page, index) => {
      await gotoWithRetries(
        page,
        'https://juejin.cn/hot/authors/6809637767543259144/1',
      );
      const loginState = await checkLoginState(page);
      if (!loginState.state) return;
      const name = await fetchFollow(page);
      this.accountLogsRepository.save({
        type: '账号',
        event: '关注',
        content: name,
        record: '关注成功',
        account: accounts[index].id,
      });
      await this.userInfoRepository.update(accounts[index].userInfo.id, {
        contribution: accounts[index].userInfo.contribution + 20,
      });
    });
  }

  // 文章自动点赞
  async autoArticleStar() {
    const accounts = await this.accountService.getAccountInfo();
    await loopPages(accounts, async (page, index) => {
      await gotoWithRetries(page, 'https://juejin.cn/');
      const loginState = await checkLoginState(page);
      if (!loginState.state) return;
      await scrollToBottom(page, 3);
      const data = await articleListStar(page);
      if (!data) return;
      this.accountLogsRepository.save({
        type: '文章',
        event: '点赞',
        content: data.title,
        link: data.link,
        account: accounts[index].id,
      });
      await this.userInfoRepository.update(accounts[index].userInfo.id, {
        contribution: accounts[index].userInfo.contribution + 10,
      });
    });
  }

  // 沸点自动点赞
  async autoPinStar() {
    const accounts = await this.accountService.getAccountInfo();
    await loopPages(accounts, async (page, index) => {
      await gotoWithRetries(page, 'https://juejin.cn/pins');
      const loginState = await checkLoginState(page);
      if (!loginState.state) return;
      const pin = await pinListStar(page);
      if (!pin) return;
      await this.accountLogsRepository.save({
        type: '沸点',
        event: '点赞',
        content: pin.content,
        link: pin.link,
        account: accounts[index].id,
      });
      await this.userInfoRepository.update(accounts[index].userInfo.id, {
        contribution: accounts[index].userInfo.contribution + 5,
      });
    });
  }

  // 文章自动评论
  async autoArticleComment() {
    const accounts = await this.accountService.getAccountInfo();
    const comments = await this.commentRepository
      .createQueryBuilder('comment')
      .where('comment.type = :type', { type: '好评' })
      .getMany();

    await loopPages(accounts, async (page, index) => {
      await gotoWithRetries(page, 'https://juejin.cn/');
      const loginState = await checkLoginState(page);
      if (!loginState.state) return;
      const data = await articleComment(page, comments);
      if (!data) return;
      this.accountLogsRepository.save({
        type: '文章',
        event: '评论',
        content: data.title,
        link: data.link,
        record: data.comment,
        account: accounts[index].id,
      });
      const id = accounts[index].id;
      const userInfo = await this.userInfoRepository.findOne({
        where: { id },
      });
      await this.userInfoRepository.update(userInfo.id, {
        contribution: userInfo.contribution + 20,
      });
      // 评论次数 + 1
      const commentId = data.id;
      await this.commentRepository.findOne({
        where: { id: commentId },
      });
      await this.commentRepository.update(commentId, {
        useCount: data.useCount + 1,
      });
    });
  }

  // 自动发布沸点
  async autoPin() {
    const accounts = await this.accountService.getAccountInfo();
    const questions = await this.pinRepository
      .createQueryBuilder('pin')
      .where('pin.isTemplate = :isTemplate', { isTemplate: true })
      .orderBy('RAND()')
      .getMany();
    if (!questions) return;
    await loopPages(accounts, async (page, index) => {
      await gotoWithRetries(page, 'https://juejin.cn/pins?source=mainHeader');
      const loginState = await checkLoginState(page);
      if (!loginState.state) return;
      await publishPin(page, questions[index].content);
      await this.accountLogsRepository.save({
        type: '沸点',
        event: '发布',
        content: questions[index].content,
        record: '发布成功',
        account: accounts[index].id,
      });
    });
  }

  // 自动发布文章
  async autoArticle() {
    const accounts = await this.accountService.getAccountInfo();

    const articleList = await fetchArticleList(accounts);

    if (articleList.length === 0) return;

    await loopPages(accounts, async (page, index) => {
      const startTimestamp = Date.now();
      const { content, description } = await fetchArticle(
        page,
        articleList[index].link,
      );
      await page.goto('https://juejin.cn/editor/drafts/new?v=2');
      await publishArticle(
        page,
        articleList[index].title,
        content,
        description,
      );
      const endTimestamp = Date.now();
      const time = (endTimestamp - startTimestamp) / 1000;
      this.accountLogsRepository.save({
        type: '文章',
        event: '发布',
        content: articleList[index].title,
        record: `发布成功，耗时${time}秒`,
        account: accounts[index].id,
      });
    });
  }

  // 获取定时任务
  async getTask(taskname: string) {
    // 获取所有任务
    const job = this.schedulerRegistry.getCronJob(taskname);
    return job.running;
  }
}
