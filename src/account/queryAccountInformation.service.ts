import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AccountService } from './account.service';
import { ManualService } from 'src/manual/manual.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class QueryAccountInformationService {
  constructor(
    @InjectQueue('manual-queue') private manualQueue: Queue,
    private readonly accountService: AccountService,
    private readonly manualService: ManualService,
  ) {}

  // 查询账号信息
  async queryAccountInformation(authorization?: string) {
    let taskPublisher = null;
    if (authorization) {
      taskPublisher = await this.manualService.checkPublisher(
        authorization,
        1,
        0,
      );
    }
    const accounts = await this.accountService.getAccountInfo();
    await this.manualQueue.add('queryAccountInformation', {
      accounts,
      taskPublisher: taskPublisher ? taskPublisher.id : 1,
    });
  }

  // 每日 3 点更新账号信息
  @Cron('0 30 3 * * *', { name: 'checkCookie', timeZone: 'Asia/Shanghai' })
  auto() {
    this.queryAccountInformation();
  }
}
