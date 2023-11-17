import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import scrollToBottom from 'src/libs/scrollToBottom';
import { Pin } from '../entities/pin.entity';
import { Keyword } from '../entities/keyword.entity';
import browserInit from 'src/libs/browserInit';
import { extract } from '@node-rs/jieba';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class PinService {
  constructor(
    @InjectRepository(Pin)
    private readonly pinRepository: Repository<Pin>,
    @InjectRepository(Keyword)
    private readonly keywordRepository: Repository<Keyword>,
  ) {}

  // 爬虫， 爬取热门沸点
  async fetchPin() {
    const { page, destroy } = await browserInit('new', true);
    await page.goto('https://juejin.cn/pins/hot');
    await page.waitForSelector('.pin-list');
    // 每隔 5秒 滚动到底部，持续 5 次。
    await scrollToBottom(page, 20);
    const result = await page.evaluate(() => {
      const list = [...document.querySelectorAll('.pin-list .pin')];
      const pins = list.map((pin) => {
        // data-pin-id 属性为 pin id
        const pinId = pin.getAttribute('data-pin-id');
        // .pin-header data-author-id 属性为作者 id
        const authorId = pin
          .querySelector('.pin-header')
          .getAttribute('data-author-id');
        // .content 为内容
        const content = pin.querySelector('.content').textContent;
        // .club 为圈子
        const club = pin.querySelector('.club')?.textContent;
        // comment-action 为评论数 转换 number 类型
        const comment = Number(
          pin.querySelector('.comment-action').textContent,
        );
        // like-action 为点赞数 转换 number 类型
        const like = Number(pin.querySelector('.like-action').textContent);

        return {
          pinId,
          authorId,
          content,
          club,
          comment,
          like,
        };
      });

      return pins;
    });
    destroy();

    // 遍历 result，将数据存入数据库
    for (let i = 0; i < result.length; i++) {
      const pin = result[i];
      const { pinId } = pin;
      // 通过 pinId 查询数据库，如果存在则更新，不存在则插入
      const existPin = await this.pinRepository.findOne({ where: { pinId } });
      if (existPin) {
        await this.pinRepository.update({ pinId }, pin);
      } else {
        await this.pinRepository.save(pin);
      }
    }

    return result;
  }

  // 分析
  async getKeyword() {
    // 获取所有 pin，只获取 content、comment、like字段
    const pins = await this.pinRepository.find({
      select: ['content', 'comment', 'like', 'pinId', 'authorId'],
    });
    // 如果 keyword weight hot comment like 全部清零
    await this.keywordRepository
      .createQueryBuilder()
      .update()
      .set({
        weight: 0,
        hot: 0,
        comment: 0,
        like: 0,
      })
      .execute();
    // 遍历 pins，分析 content，提取关键词
    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i];
      const { content, like, comment } = pin;
      const keywords = extract(content, 5, 'n,nr,ns,nt,nw,nz,vn');
      // 排除空数组
      if (keywords.length === 0) continue;
      // 遍历 keywords，将数据存入数据库
      for (let j = 0; j < keywords.length; j++) {
        const keywordContent = keywords[j];
        const { weight, keyword } = keywordContent;
        // 在 keyword 表中查找 keyword 是否存在
        const keywordEntity = await this.keywordRepository.findOne({
          where: { word: keyword },
        });
        // 模糊查询 keyword 在 pinRepository 中的数量
        const count = await this.pinRepository
          .createQueryBuilder('pin')
          .where('pin.content LIKE :keyword', { keyword: `%${keyword}%` })
          .getCount();
        const hot = weight * (like + comment);
        // 如果存在，更新热度
        if (keywordEntity) {
          keywordEntity.hot += hot;
          keywordEntity.weight += weight;
          keywordEntity.count = count;
          keywordEntity.comment += comment;
          keywordEntity.like += like;
          // 判断 pinId 是否存在，如果不存在则添加
          if (!keywordEntity.pinIds.includes(`${pin.pinId}`)) {
            keywordEntity.pinIds += `,${pin.pinId}`;
          }
          // 判断 authorId 是否存在，如果不存在则添加
          if (!keywordEntity.authorIds.includes(`${pin.authorId}`)) {
            keywordEntity.authorIds += `,${pin.authorId}`;
          }
          await this.keywordRepository.save(keywordEntity);
        } else {
          // 如果不存在，创建 keywordEntity
          const newKeywordEntity = this.keywordRepository.create({
            word: keyword,
            weight,
            hot,
            count,
            comment,
            like,
            pinIds: pin.pinId,
            authorIds: pin.authorId,
          });
          await this.keywordRepository.save(newKeywordEntity);
        }
      }
    }
  }

  // 数据库查询
  async getKeywordList() {
    // 前 20 条数据，按照 hot 降序排列，isBlock 为 false
    const keywordList = await this.keywordRepository.find({
      where: { isBlock: false },
      order: { hot: 'DESC' },
      take: 20,
    });
    return keywordList.map((item) => ({
      ...item,
      pinIds: item.pinIds.split(',').filter((id) => id),
      authorIds: item.authorIds.split(',').filter((id) => id),
    }));
  }

  // 设置关键词是否屏蔽
  async blockKeyword(id: number, isBlock: boolean) {
    // 根据 id 查询 keyword
    const keyword = await this.keywordRepository.findOne({
      where: {
        id,
      },
    });
    keyword.isBlock = isBlock;
    await this.keywordRepository.save(keyword);
  }

  // 根据 pinId 获取 pin 详情
  async getPinDetail(pinId: string) {
    const pin = await this.pinRepository.findOne({ where: { pinId } });
    return pin;
  }

  // 定时爬取沸点
  @Cron('0 0 0 * * *', { name: 'fetchPin', timeZone: 'Asia/Shanghai' })
  async cronTask() {
    await this.fetchPin();
    await this.getKeyword();
  }
}
