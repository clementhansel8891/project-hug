import { v4 as uuidv4 } from 'uuid';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';

@Injectable()
export class BulletinService {
  constructor(private readonly prisma: PrismaService) {}

  async createPost(params: {
    tenant_id: string;
    authorId: string;
    title: string;
    body: string;
    category?: string;
    isPinned?: boolean;
    scopeType?: string;
    scopeId?: string;
  }) {
    return this.prisma.bulletin_posts.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        tenant_id: params.tenant_id,
        author_id: params.authorId,
        title: params.title,
        body: params.body,
        category: params.category ?? 'general',
        is_pinned: params.isPinned ?? false,
        scope_type: params.scopeType ?? 'company',
        scope_id: params.scopeId ?? null,
      },
    });
  }

  async getPosts(tenant_id: string, filters: any) {
    const page = filters.page ?? 1;
    const limit = filters.limit ? parseInt(filters.limit) : 100;
    const skip = (page - 1) * limit;

    const where: any = { 
      tenant_id: tenant_id,
      deleted_at: null,
      status: 'published',
    };

    if (filters.category) where.category = filters.category;
    if (filters.authorId) where.author_id = filters.authorId;

    const [data, total] = await Promise.all([
      this.prisma.bulletin_posts.findMany({
        where,
        orderBy: [
          { is_pinned: 'desc' },
          { created_at: 'desc' },
        ],
        include: {
          _count: {
            select: { 
              bulletin_reactions: true, 
              bulletin_comments: true,
              bulletin_reads: true 
            }
          },
          bulletin_reactions: {
            select: { type: true, user_id: true }
          }
        },
        skip,
        take: limit,
      }),
      this.prisma.bulletin_posts.count({ where }),
    ]);

    // Map to include counts by type
    const enrichedData = (data as any[]).map(post => {
      const likes = post.bulletin_reactions.filter((r: any) => r.type === 'LIKE').length;
      const dislikes = post.bulletin_reactions.filter((r: any) => r.type === 'DISLIKE').length;
      return {
        ...post,
        likesCount: likes,
        dislikesCount: dislikes,
        commentsCount: post._count.bulletin_comments,
      };
    });

    return { data: enrichedData, total, page, limit };
  }

  async getPostsPaginated(tenant_id: string, pagination: { page: number; pageSize: number }, filters: { category?: string; authorId?: string } = {}) {
    const skip = (pagination.page - 1) * pagination.pageSize;

    const where: any = {
      tenant_id: tenant_id,
      deleted_at: null,
      status: 'published',
    };

    if (filters.category) where.category = filters.category;
    if (filters.authorId) where.author_id = filters.authorId;

    const [data, totalCount] = await Promise.all([
      this.prisma.bulletin_posts.findMany({
        where,
        orderBy: [
          { is_pinned: 'desc' },
          { created_at: 'desc' },
        ],
        include: {
          _count: {
            select: {
              bulletin_reactions: true,
              bulletin_comments: true,
              bulletin_reads: true
            }
          },
          bulletin_reactions: {
            select: { type: true, user_id: true }
          }
        },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.bulletin_posts.count({ where }),
    ]);

    const enrichedData = (data as any[]).map(post => {
      const likes = post.bulletin_reactions.filter((r: any) => r.type === 'LIKE').length;
      const dislikes = post.bulletin_reactions.filter((r: any) => r.type === 'DISLIKE').length;
      return {
        ...post,
        likesCount: likes,
        dislikesCount: dislikes,
        commentsCount: post._count.bulletin_comments,
      };
    });

    return {
      data: enrichedData,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  async getPostById(tenant_id: string, id: string) {
    const post = await this.prisma.bulletin_posts.findFirst({
      where: { id, tenant_id: tenant_id, deleted_at: null },
      include: {
        bulletin_comments: {
          orderBy: { created_at: 'desc' },
        },
        bulletin_reactions: {
          select: { type: true, user_id: true }
        },
        _count: {
          select: { bulletin_reactions: true, bulletin_reads: true, bulletin_comments: true },
        },
      },
    });

    if (!post) return null;

    return {
      ...post,
      likesCount: post.bulletin_reactions.filter((r: any) => r.type === 'LIKE').length,
      dislikesCount: post.bulletin_reactions.filter((r: any) => r.type === 'DISLIKE').length,
      commentsCount: post._count.bulletin_comments,
    };
  }

  async addComment(params: {
    tenant_id: string;
    postId: string;
    authorId: string;
    body: string;
  }) {
    return this.prisma.bulletin_comments.create({
      data: {
        id: uuidv4(),
        created_at: new Date(),
        updated_at: new Date(),
        tenant_id: params.tenant_id,
        post_id: params.postId,
        author_id: params.authorId,
        body: params.body,
      },
    });
  }

  async toggleReaction(params: {
    tenant_id: string;
    postId: string;
    user_id: string;
    type: string; // 'LIKE' or 'DISLIKE'
  }) {
    const existing = await this.prisma.bulletin_reactions.findFirst({
      where: {
        post_id: params.postId,
        user_id: params.user_id,
        tenant_id: params.tenant_id,
      },
    });

    if (existing) {
      // If clicking same type, remove it
      if (existing.type === params.type) {
        return this.prisma.bulletin_reactions.delete({
          where: { id: existing.id },
        });
      }
      // If clicking different type, update it
      return this.prisma.bulletin_reactions.update({
        where: { id: existing.id },
        data: { type: params.type, updated_at: new Date() },
      });
    }

    // New reaction
    return this.prisma.bulletin_reactions.create({
      data: {
        id: uuidv4(),
        created_at: new Date(),
        updated_at: new Date(),
        post_id: params.postId,
        user_id: params.user_id,
        tenant_id: params.tenant_id,
        type: params.type,
      },
    });
  }

  async updatePost(tenant_id: string, id: string, data: any) {
    return this.prisma.bulletin_posts.update({
      where: { id, tenant_id: tenant_id },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
  }

  async deletePost(tenant_id: string, id: string) {
    return this.prisma.bulletin_posts.update({
      where: { id, tenant_id: tenant_id },
      data: {
        deleted_at: new Date(),
        status: 'archived',
      },
    });
  }

  // Categories management
  async getCategories(tenant_id: string) {
    return this.prisma.bulletin_categories.findMany({
      where: { tenant_id: tenant_id },
      orderBy: { name: 'asc' },
      take: 100
    });
  }

  async createCategory(tenant_id: string, data: { name: string; code: string; color?: string }) {
    return this.prisma.bulletin_categories.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        tenant_id: tenant_id,
        ...data,
      },
    });
  }

  async updateCategory(tenant_id: string, id: string, data: any) {
    return this.prisma.bulletin_categories.update({
      where: { id, tenant_id: tenant_id },
      data: { ...data, updated_at: new Date() },
    });
  }

  async deleteCategory(tenant_id: string, id: string) {
    // Check if any posts use this category code
    const category = await this.prisma.bulletin_categories.findFirst({ where: { id, tenant_id: tenant_id } });
    if (!category) return null;

    // We don't strictly enforce relational integrity with string codes here, 
    // but we could update posts or just let it be.
    return this.prisma.bulletin_categories.delete({
      where: { id, tenant_id: tenant_id },
    });
  }
}
