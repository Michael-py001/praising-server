import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pin } from 'src/entities/pin.entity';
import { Keyword } from 'src/entities/keyword.entity';
import { AccountModule } from 'src/account/account.module';
import { PinController } from './pin.controller';
import { PinService } from './pin.service';

// 沸点分析模块
@Module({
  imports: [TypeOrmModule.forFeature([Pin, Keyword]), AccountModule],
  controllers: [PinController],
  providers: [PinService],
  exports: [PinService],
})
export class PinModule {}
