import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Account } from 'src/entities/account.entity';
import { UserInfo } from 'src/entities/userinfo.entity';
import { AccountLog } from 'src/entities/accountLog.entity';

import { setCookie } from 'src/libs/cookie';

import browserInit from 'src/libs/browserInit';
import { UserCaptchaService } from 'src/user/userCaptcha.service';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(AccountLog)
    private readonly accountLogRepository: Repository<AccountLog>,
    private readonly userCaptchaService: UserCaptchaService,
  ) {}

  // 获取可访问账号信息，随机返回
  async getAccountInfo(quantity?: number) {
    const accounts = await this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.userInfo', 'userInfo')
      .where('account.cookie != :cookie', { cookie: '' })
      .getMany();

    let sum = accounts.length;
    if (quantity) {
      sum = quantity;
    }

    const randomAccounts = [];
    for (let index = 0; index < sum; index++) {
      const randomIndex = Math.floor(Math.random() * accounts.length);
      randomAccounts.push(accounts[randomIndex]);
      accounts.splice(randomIndex, 1);
    }
    return randomAccounts;
  }

  // 单独访问账号
  async visitAccount(id: number) {
    // 根据 id 查询账号
    const account = await this.accountRepository.findOne({
      where: { id },
    });
    const { page } = await browserInit(false, true);
    await setCookie(page, account.cookie);
    await page.goto('https://juejin.cn/');
    // 需要手动关闭
    // destroy();
  }

  // 查询所有账号的信息
  async findAllWithUserInfo(page: number, pageSize: number) {
    // 分页查询
    const accounts = await this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.userInfo', 'userInfo')
      .orderBy('account.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const mergedAccounts = accounts[0].map((account) => {
      const data = Object.assign({}, account, account.userInfo, {
        state: account.cookie ? true : false,
        id: account.id,
      });
      delete data.cookie;
      delete data.userInfo;
      return data;
    });
    return {
      records: mergedAccounts,
      total: accounts[1],
    };
  }

  // 手动登录获取 cookie
  async getCookie() {
    const accounts = await this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.userInfo', 'userInfo')
      // 具有 account 和 password
      .where('account.account != :account', { account: '' })
      .andWhere('account.password != :password', { password: '' })
      // 并且 cookie 为 null
      .andWhere('account.cookie is null')
      .getMany();

    for (let index = 0; index < accounts.length; index++) {
      const account = accounts[index];
      try {
        await this.userCaptchaService.loginWithPassword(
          account.account,
          account.password,
        );
      } catch (error) {
        console.log(error);
      }
    }
  }

  // 分页获取日志，account 关联 userInfo
  async getAccountLog(page = 1, pageSize = 10, type: string) {
    const [data, total] = await this.accountLogRepository
      .createQueryBuilder('accountLog')
      .leftJoinAndSelect('accountLog.account', 'account')
      .leftJoinAndSelect('account.userInfo', 'userInfo')
      // type 如果存在则查询对应的日志
      .where(type ? 'accountLog.type = :type' : '1=1', { type })
      .orderBy('accountLog.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const records = data.map((log: AccountLog) => {
      const account = log.account as unknown as Account;
      const userInfo = account.userInfo as unknown as UserInfo;
      const result = Object.assign({}, log, {
        username: userInfo.username,
        userId: userInfo.userId,
        avatar: userInfo.avatar,
      });
      delete result.account;
      return result;
    });

    return {
      records: records,
      page,
      total,
      pageSize,
    };
  }

  // 已读日志
  async readLog(ids: string[]) {
    return this.accountLogRepository.update({ id: In(ids) }, { isRead: true });
  }

  // importAccount
  async importAccount(data: Account[]) {
    for (let index = 0; index < data.length; index++) {
      const account = data[index];
      try {
        // 判断 account 是否存在
        const existAccount = await this.accountRepository.findOne({
          where: { account: account.account },
        });
        if (!existAccount) {
          await this.userCaptchaService.loginWithPassword(
            account.account,
            account.password,
          );
        }
      } catch (error) {
        console.log(error);
      }
    }
  }
}
