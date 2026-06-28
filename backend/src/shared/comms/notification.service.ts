import { v4 as uuidv4 } from 'uuid';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(params: {
    tenant_id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    link?: string;
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    event_reference_id: string;
  }) {
    return this.prisma.notifications.create({
      data: {
          updated_at: new Date(),
        id: uuidv4(),
        
        tenant_id: params.tenant_id,
        user_id: params.user_id,
        title: params.title,
        message: params.message,
        type: params.type,
        link: params.link || null,
        priority: params.priority || "NORMAL",
        event_reference_id: params.event_reference_id || null,
        status: params.priority === "URGENT" ? "PENDING" : "SENT", // Urgent might need separate worker processing
      },
    });
  }

  async retryNotification(tenant_id: string, id: string) {
    const notification = await this.prisma.notifications.findUnique({
      where: { id, tenant_id: tenant_id },
    });

    if (!notification || notification.retry_count >= 5) {
      return notification;
    }

    return this.prisma.notifications.update({
      where: { id, tenant_id: tenant_id },
      data: {
        retry_count: { increment: 1 },
        last_retry_at: new Date(),
        status: "PENDING", // Signal for re-delivery
      },
    });
  }

  async getNotifications(tenant_id: string, user_id: string, filters: any = {}) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.notifications.findMany({
        where: { tenant_id: tenant_id, user_id: user_id },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notifications.count({
        where: { tenant_id: tenant_id, user_id: user_id },
      }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Get paginated notifications using standard pagination envelope.
   */
  async getNotificationsPaginated(tenant_id: string, user_id: string, pagination: { page: number; pageSize: number }) {
    const skip = (pagination.page - 1) * pagination.pageSize;

    const [data, totalCount] = await Promise.all([
      this.prisma.notifications.findMany({
        where: { tenant_id, user_id },
        orderBy: { created_at: 'desc' },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.notifications.count({
        where: { tenant_id, user_id },
      }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  async markAsRead(tenant_id: string, id: string) {
    return this.prisma.notifications.update({
      where: { id, tenant_id: tenant_id },
      data: { is_read: true },
    });
  }

  async markAllAsRead(tenant_id: string, user_id: string) {
    return this.prisma.notifications.updateMany({
      where: { tenant_id: tenant_id, user_id: user_id, is_read: false },
      data: { is_read: true },
    });
  }

  async getUnreadCounts(tenant_id: string, user_id: string) {
    // Get mail account first
    const account = await this.prisma.mail_accounts.findFirst({
      where: { tenant_id: tenant_id, user_id: user_id, deleted_at: null }
    });

    const [notifCount, mailCount, rooms] = await Promise.all([
      this.prisma.notifications.count({
        where: { tenant_id: tenant_id, user_id: user_id, is_read: false },
      }),
      account ? this.prisma.mail_messages.count({
        where: { 
          tenant_id: tenant_id, 
          to_addresses: { array_contains: account.address }, 
          is_read: false,
          status: 'sent',
          deleted_at: null 
        }
      }) : Promise.resolve(0),
      this.prisma.chat_rooms.findMany({
        where: {
          tenant_id: tenant_id,
          chat_members: { some: { user_id: user_id } },
          deleted_at: null
        },
        include: {
          chat_members: { where: { user_id: user_id } }
        },
        take: 100
      })
    ]);

    // For chats, we'd ideally compare message count vs lastReadAt, 
    // but for now let's return rooms with any unread flag if possible
    // A more advanced query would be needed for exact Chat unread count.
    const chatCount = rooms.length; // Placeholder: Just returning count of joined rooms for now

    return {
      total: notifCount + mailCount + chatCount,
      notifications: notifCount,
      mail: mailCount,
      chat: chatCount
    };
  }
}
