import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PinService } from './pin.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PinsDto } from './pin.dto';

@ApiTags('沸点分析')
@Controller('pin')
export class PinController {
  constructor(private readonly pinService: PinService) {}

  @ApiOperation({ summary: '爬取沸点' })
  @Get('fetch')
  fetchPin() {
    return this.pinService.fetchPin();
  }

  @ApiOperation({ summary: '执行分析' })
  @Get('analysis')
  async getKeyword() {
    await this.pinService.getKeyword();
    return '执行分析完成';
  }

  @ApiOperation({ summary: '获取关键词列表' })
  @Get('list')
  async getKeywordList(@Query('size') size = 20) {
    const data = await this.pinService.getKeywordList(Number(size));
    return {
      data,
    };
  }

  @ApiOperation({ summary: '屏蔽关键词' })
  @Get('block')
  async blockKeyword(
    @Query('id') id: string,
    @Query('isBlock') isBlock: string,
  ) {
    await this.pinService.blockKeyword(
      Number.parseInt(id),
      !!Number.parseInt(isBlock),
    );
    return '屏蔽关键词完成';
  }

  // 根据沸点 id 获取沸点详情
  @ApiOperation({ summary: '根据id获取详情' })
  @Get('detail')
  async getPinDetail(@Query('pinId') pinId: string) {
    const data = await this.pinService.getPinDetail(pinId);
    return {
      data,
    };
  }

  // 根据沸点 ids 获取沸点详情
  @ApiOperation({ summary: '根据ids获取详情' })
  @Post('detailList')
  async getPinDetailList(@Body() pinDto: PinsDto) {
    const data = await this.pinService.getPinDetailList(pinDto.ids);
    return {
      data,
    };
  }
}
