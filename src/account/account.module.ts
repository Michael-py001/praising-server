import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from 'src/entities/account.entity';
import { UserInfo } from 'src/entities/userinfo.entity';
import { AccountLog } from 'src/entities/accountLog.entity';
import { AccountAuthService } from './accountAuth.service';
import { AuthAdminGuard } from 'src/common/guards/authAdmin.guard';
import { BullModule } from '@nestjs/bull';
import { CheckCookieService } from './checkCookie.service';
import { ManualService } from 'src/manual/manual.service';
import { QueryAccountInformationService } from './queryAccountInformation.service';
import { UserCaptchaService } from 'src/user/userCaptcha.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'manual-queue',
    }),
    TypeOrmModule.forFeature([Account, UserInfo, AccountLog]),
  ],
  controllers: [AccountController],
  providers: [
    AccountService,
    AccountAuthService,
    AuthAdminGuard,
    CheckCookieService,
    ManualService,
    QueryAccountInformationService,
    UserCaptchaService,
  ],
  exports: [AccountService, AccountAuthService],
})
export class AccountModule {}
