import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AccountService } from './account.service';
import { ReadLogDto } from './account.dto';
import { AuthAdminGuard } from 'src/common/guards/authAdmin.guard';
import { CheckCookieService } from './checkCookie.service';
import { QueryAccountInformationService } from './queryAccountInformation.service';

@ApiTags('账号管理')
@Controller('account')
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly checkCookieService: CheckCookieService,
    private readonly queryAccountInformationService: QueryAccountInformationService,
  ) {}

  @ApiOperation({ summary: '单独访问账号（本地服务）' })
  @Get('visitAccount')
  @UseGuards(AuthAdminGuard)
  async visitAccount(@Query('id') id: number) {
    const data = await this.accountService.visitAccount(id);
    return {
      data,
      message: '访问成功',
    };
  }

  @ApiOperation({ summary: '查询所有账号的信息' })
  @Get('findAll')
  async findAll(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
  ) {
    const data = await this.accountService.findAllWithUserInfo(
      Number.parseInt(page),
      Number.parseInt(pageSize),
    );
    return {
      data,
      message: '查询成功',
    };
  }

  @ApiOperation({ summary: '手动登录获取 cookie（本地服务）' })
  @Get('getCookie')
  @UseGuards(AuthAdminGuard)
  getCookie() {
    this.accountService.getCookie();
    return {
      message: '已启动手动登录，等待登录成功后自动关闭',
    };
  }

  @ApiOperation({ summary: '检测 cookie 是否过期' })
  @Get('checkCookie')
  @UseGuards(AuthAdminGuard)
  async checkCookie(@Headers('authorization') authorization: string) {
    this.checkCookieService.checkCookie(authorization);
    return {
      message: '开始检测',
    };
  }

  @ApiOperation({ summary: '爬取账号信息' })
  @Get('queryAccountInformation')
  @UseGuards(AuthAdminGuard)
  queryAccountInformation() {
    this.queryAccountInformationService.queryAccountInformation();
    return {
      message: '已启动',
    };
  }

  @ApiOperation({ summary: '查询日志信息' })
  @Get('accountLog')
  // 分页获取日志
  async accountLog(
    @Query('page') page: number,
    @Query('pageSize') pageSize: number,
    @Query('type') type: string,
  ) {
    const data = await this.accountService.getAccountLog(page, pageSize, type);
    return {
      data,
      message: '查询成功',
    };
  }

  @ApiOperation({ summary: '已读日志' })
  @Post('readLog')
  @ApiBody({ type: ReadLogDto })
  async readLog(@Body() readLogDto: ReadLogDto) {
    const data = await this.accountService.readLog(readLogDto.ids);
    return {
      data,
      message: '已读成功',
    };
  }

  // 将 json 账号导入数据库
  @ApiOperation({ summary: '导入账号' })
  @Post('importAccount')
  async importAccount(@Body() body: any) {
    const data = this.accountService.importAccount(body);
    return {
      data,
      message: '开始导入',
    };
  }
}
