import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from 'src/entities/comment.entity';
import { CommentDto } from './comment.dto';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  // 分页获取评论列表
  async list(page: number, pageSize: number, type: string) {
    // 分页获取评论列表 和 总数，根据时间倒序
    const [records, total] = await this.commentRepository.findAndCount({
      where: {
        type,
      },
      order: {
        id: 'DESC',
      },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });

    return {
      records,
      total,
      page,
      pageSize,
    };
  }

  // 添加评论
  async add(commentData: CommentDto) {
    const comment = new Comment();
    comment.content = commentData.content;
    comment.type = commentData.type;
    comment.enable = commentData.enable;
    // 判断是否存在同样的 content
    const existComment = await this.commentRepository.findOne({
      where: { content: commentData.content },
    });
    if (existComment !== undefined) {
      return false;
    } else {
      await this.commentRepository.save(comment);
      return comment;
    }
  }

  // 修改评论
  async update(id: number, content: string, enable: boolean, type: string) {
    const comment = await this.commentRepository.findOne({
      where: { id },
    });
    if (comment !== undefined) {
      comment.content = content;
    }
    if (enable !== undefined) {
      comment.enable = enable;
    }
    if (type !== undefined) {
      comment.type = type;
    }
    await this.commentRepository.save(comment);
    return comment;
  }

  // 删除评论
  async delete(ids: number[]) {
    // 循环删除
    for (let index = 0; index < ids.length; index++) {
      const id = ids[index];
      await this.commentRepository.delete(id);
    }
    return true;
  }
}
