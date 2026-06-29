import { v4 as uuidv4 } from 'uuid';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { mapPrismaError } from '../../core/_shared/errors/prisma-error.mapper';

@Injectable()
export class MailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  async getMessages(tenant_id: string, user_id: string, folder: string, filters: any = {}) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    // Ensure user has at least one account
    let account = await this.prisma.mail_accounts.findFirst({
      where: { tenant_id: tenant_id, user_id: user_id, deleted_at: null }
    });

    if (!account) {
      account = await this.prisma.mail_accounts.create({
        data: {
        id: uuidv4(),
        updated_at: new Date(),
          tenant_id: tenant_id,
          user_id: user_id,
          address: `${user_id.split('-')[0]}@zenvix.internal`,
          type: 'internal',
          display_name: 'Employee Account',
          status: 'active'
        }
      });
    }

    const where: any = {
      tenant_id: tenant_id,
      deleted_at: folder === 'trash' ? { not: null } : null,
    };

    if (folder === 'inbox') {
      // Internal inbox logic: where recipient includes account address
      where.to_addresses = { array_contains: account.address };
      where.status = 'sent';
      where.deleted_at = null;
    } else if (folder === 'sent') {
      where.from_account_id = account.id;
      where.status = 'sent';
      where.deleted_at = null;
    } else if (folder === 'drafts') {
      where.from_account_id = account.id;
      where.status = 'draft';
      where.deleted_at = null;
    } else if (folder === 'starred' || folder === 'flagged') {
      where.is_starred = true;
      where.deleted_at = null;
      // Should also be either from or to the user
      where.OR = [
        { from_account_id: account.id },
        { to_addresses: { array_contains: account.address } }
      ];
    } else if (folder === 'trash') {
      where.deleted_at = { not: null };
      where.OR = [
        { from_account_id: account.id },
        { to_addresses: { array_contains: account.address } }
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.mail_messages.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          mail_accounts: true,
        }
      }),
      this.prisma.mail_messages.count({ where }),
    ]);

    return { data, total, page, limit, account };
  }

  async sendMail(params: {
    tenant_id: string;
    user_id: string;
    toAddresses: string[];
    ccAddresses?: string[];
    subject: string;
    bodyHtml?: string;
    bodyText: string;
    status?: string;
  }) {
    if (!params.toAddresses || params.toAddresses.length === 0) {
      throw new BadRequestException('At least one recipient address is required.');
    }
    if (!params.subject) {
      throw new BadRequestException('Subject is required.');
    }

    try {
    // 1. Get or Create user's sender account
    let account = await this.prisma.mail_accounts.findFirst({
      where: { tenant_id: params.tenant_id, user_id: params.user_id, deleted_at: null }
    });

    if (!account) {
      account = await this.prisma.mail_accounts.create({
        data: {
        id: uuidv4(),
        updated_at: new Date(),
          tenant_id: params.tenant_id,
          user_id: params.user_id,
          address: `${params.user_id.split('-')[0]}@zenvix.internal`,
          type: 'internal',
          display_name: 'Employee Account',
          status: 'active'
        }
      });
    }

    // 2. Create Thread
    const thread = await this.prisma.mail_threads.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        tenant_id: params.tenant_id,
        subject: params.subject,
      },
    });

    // 3. Create Message
    const message = await this.prisma.mail_messages.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        tenant_id: params.tenant_id,
        thread_id: thread.id,
        from_account_id: account.id,
        from_address: account.address,
        to_addresses: params.toAddresses as any,
        cc_addresses: params.ccAddresses as any,
        subject: params.subject,
        body_html: params.bodyHtml,
        body_text: params.bodyText,
        status: params.status || 'sent',
        sent_at: params.status === 'draft' ? null : new Date(),
      },
    });
    // 4. Notify all recipients
    if (message.status === 'sent') {
      for (const address of params.toAddresses) {
        const recipientAccount = await this.prisma.mail_accounts.findFirst({
          where: { tenant_id: params.tenant_id, address, deleted_at: null }
        });
        if (recipientAccount && recipientAccount.user_id !== params.user_id) {
          // Create Notification record
          const notification = await this.notificationService.createNotification({
            tenant_id: params.tenant_id,
            user_id: recipientAccount.user_id,
            title: 'New Secure Transmission',
            message: `New organizational intel received from ${account.address}: ${params.subject}`,
            type: 'MAIL',
            link: '/core/mail',
            priority: 'NORMAL',
            event_reference_id: message.id,
          });

          // Broadcast real-time
          await this.notificationGateway.broadcastNotification({
            tenant_id: params.tenant_id,
            user_id: recipientAccount.user_id,
            notification
          });
        }
      }
    }

    return message;
    } catch (error) {
      mapPrismaError(error, 'MailSend');
    }
  }

  async getMailAccounts(tenant_id: string, user_id: string) {
    return this.prisma.mail_accounts.findMany({
      where: { tenant_id: tenant_id, user_id: user_id, deleted_at: null },
    });
  }

  /**
   * Get paginated mail messages using standard pagination envelope.
   */
  async getMessagesPaginated(tenant_id: string, user_id: string, folder: string, pagination: { page: number; pageSize: number }) {
    const skip = (pagination.page - 1) * pagination.pageSize;

    // Ensure user has at least one account
    let account = await this.prisma.mail_accounts.findFirst({
      where: { tenant_id, user_id, deleted_at: null }
    });

    if (!account) {
      account = await this.prisma.mail_accounts.create({
        data: {
          id: uuidv4(),
          updated_at: new Date(),
          tenant_id,
          user_id,
          address: `${user_id.split('-')[0]}@zenvix.internal`,
          type: 'internal',
          display_name: 'Employee Account',
          status: 'active'
        }
      });
    }

    const where: any = {
      tenant_id,
      deleted_at: folder === 'trash' ? { not: null } : null,
    };

    if (folder === 'inbox') {
      where.to_addresses = { array_contains: account.address };
      where.status = 'sent';
      where.deleted_at = null;
    } else if (folder === 'sent') {
      where.from_account_id = account.id;
      where.status = 'sent';
      where.deleted_at = null;
    } else if (folder === 'drafts') {
      where.from_account_id = account.id;
      where.status = 'draft';
      where.deleted_at = null;
    } else if (folder === 'starred' || folder === 'flagged') {
      where.is_starred = true;
      where.deleted_at = null;
      where.OR = [
        { from_account_id: account.id },
        { to_addresses: { array_contains: account.address } }
      ];
    } else if (folder === 'trash') {
      where.deleted_at = { not: null };
      where.OR = [
        { from_account_id: account.id },
        { to_addresses: { array_contains: account.address } }
      ];
    }

    const [data, totalCount] = await Promise.all([
      this.prisma.mail_messages.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pagination.pageSize,
        include: { mail_accounts: true },
      }),
      this.prisma.mail_messages.count({ where }),
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
    return this.prisma.mail_messages.update({
      where: { id, tenant_id: tenant_id },
      data: { is_read: true },
    });
  }

  async toggleStar(tenant_id: string, id: string) {
    const mail = await this.prisma.mail_messages.findUnique({ where: { id, tenant_id: tenant_id } });
    if (!mail) throw new NotFoundException('Mail not found');

    return this.prisma.mail_messages.update({
      where: { id, tenant_id: tenant_id },
      data: { is_starred: !mail.is_starred },
    });
  }

  async deleteMail(tenant_id: string, id: string) {
    // If already in trash, delete permanently? No, let's stick to soft delete.
    const mail = await this.prisma.mail_messages.findUnique({ where: { id, tenant_id: tenant_id } });
    if (mail?.deleted_at) {
      return this.prisma.mail_messages.delete({ where: { id, tenant_id: tenant_id } });
    }
    return this.prisma.mail_messages.update({
      where: { id, tenant_id: tenant_id },
      data: { deleted_at: new Date() },
    });
  }

  async restoreMail(tenant_id: string, id: string) {
    return this.prisma.mail_messages.update({
      where: { id, tenant_id: tenant_id },
      data: { deleted_at: null },
    });
  }
}
