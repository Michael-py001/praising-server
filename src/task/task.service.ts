import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { AutomateService } from 'src/automate/automate.service';
import { Account } from 'src/entities/account.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TaskService {
  constructor(
    private readonly automateService: AutomateService,
    @InjectQueue('manual-queue') private manualQueue: Queue,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
  ) {}

  // 根据任务 ID 查询任务状态
  async searchTask(taskId: string) {
    const data = await this.manualQueue.getJob(taskId);
    if (data) {
      if (data.data.accounts) {
        data.data.usernames = data.data.accounts.map((item: Account) => {
          return item.userInfo.username;
        });
        delete data.data.accounts;
      } else {
        data.data.usernames = [data.data.account.userInfo.username];
        delete data.data.account;
      }
    }
    return data;
  }

  // 查询未执行完成任务列队
  async searchUnexecutedTaskList(authorization) {
    // 查询账号是否是否存在
    const account = await this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.userInfo', 'userInfo')
      .where('account.cookie = :cookie', { cookie: authorization })
      .getOne();

    if (!account) {
      throw new Error('账号不存在');
    }

    let data = await this.manualQueue.getJobs([
      'active',
      'waiting',
      'delayed',
      'paused',
    ]);

    // 最后一个执行完毕的任务
    const lastCompletedJob = await this.manualQueue.getCompleted();

    // 插入到任务列表的第一个
    if (data && lastCompletedJob.length) {
      data.push(lastCompletedJob[0]);
    }

    if (data.length) {
      data = data.filter((item) => {
        return item.data.taskPublisher === account.id;
      });
      for (let index = 0; index < data.length; index++) {
        const jobData = data[index];
        jobData.data.usernames = jobData.data.accounts.map((item: Account) => {
          return item.userInfo.username;
        });
        jobData.data.avatars = jobData.data.accounts.map((item: Account) => {
          return item.userInfo.avatar;
        });
        delete jobData.data.accounts;
        jobData.data.taskPublisherName = account.userInfo.username;
      }
    }
    return data;
  }

  // 终止任务
  async stopTask(taskId: string) {
    const data = await this.manualQueue.getJob(taskId);
    if (data) {
      await data.remove();
    }
    return data.id;
  }

  // 终止所有任务
  async stopAllTask(authorization: string) {
    // 查询账号是否是否存在
    const account = await this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.userInfo', 'userInfo')
      .where('account.cookie = :cookie', { cookie: authorization })
      .getOne();

    if (!account) {
      throw new Error('账号不存在');
    }

    let data = await this.manualQueue.getJobs([
      'active',
      'waiting',
      'delayed',
      'paused',
    ]);
    if (data.length) {
      data = data.filter((item) => {
        return item.data.taskPublisher === account.id;
      });
      for (let index = 0; index < data.length; index++) {
        const jobData = data[index];
        await jobData.remove();
      }
    }
    return data.map((item) => {
      return item.id;
    });
  }

  // 定时签到，每天4,5,6,7,8点签到，重复签到，防止漏签
  @Cron('0 0 4,5,6,7,8 * * *', { name: 'autoSign', timeZone: 'Asia/Shanghai' })
  autoSign() {
    this.automateService.autoSign();
  }

  // 定时点赞，每天8点30文章点赞
  @Cron('0 30 7 * * *', { name: 'autoArticleStar', timeZone: 'Asia/Shanghai' })
  autoArticleStar() {
    this.automateService.autoArticleStar();
  }

  // 定时点赞，每天8点沸点点赞
  @Cron('0 0 8 * * *', { name: 'autoPinStar', timeZone: 'Asia/Shanghai' })
  autoPinStar() {
    this.automateService.autoPinStar();
  }

  // 定时评论，每天8点30评论
  // @Cron('0 30 8 * * *', {
  //   name: 'autoArticleComment',
  //   timeZone: 'Asia/Shanghai',
  // })
  // autoArticleComment() {
  //   this.automateService.autoArticleComment();
  // }

  // 定时关注，每周一，20点关注
  @Cron('0 0 20 * * 1', { name: 'autoFollow', timeZone: 'Asia/Shanghai' })
  autoFollow() {
    this.automateService.autoFollow();
  }

  // 定时发布沸点，每周二，20点发布
  @Cron('0 0 20 * * 2', { name: 'autoPin', timeZone: 'Asia/Shanghai' })
  autoPin() {
    this.automateService.autoPin();
  }

  // 定时发布文章，每周五，20点发布
  @Cron('0 0 20 * * 5', { name: 'autoArticle', timeZone: 'Asia/Shanghai' })
  autoArticle() {
    this.automateService.autoArticle();
  }
}
