import { v4 as uuidv4 } from 'uuid';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationGateway: NotificationGateway,
    private readonly notificationService: NotificationService,
  ) {}

  private buildDirectKey(userIds: string[]) {
    return [...userIds].sort().join("_");
  }

  async createRoom(params: {
    tenant_id: string;
    createdBy: string;
    type: 'DIRECT' | 'GROUP' | 'DEPARTMENT' | 'LOCATION' | 'ROLE' | 'COMPANY';
    name?: string;
    memberUserIds: string[];
  }) {
    // Part 2: Prevent duplicate DIRECT chats
    let directKey: string | undefined;
    if (params.type === 'DIRECT') {
      directKey = this.buildDirectKey(params.memberUserIds);
      const existing = await this.prisma.chat_rooms.findFirst({
        where: { tenant_id: params.tenant_id, type: 'DIRECT', direct_key: directKey }
      });
      if (existing) return existing;
    }

    return this.prisma.$transaction(async (tx: any) => {
      const room = await tx.chat_rooms.create({
        data: {
          id: uuidv4(),
          updated_at: new Date(),
          tenant_id: params.tenant_id,
          created_by: params.createdBy,
          type: params.type,
          name: params.name || null,
          direct_key: directKey,
        },
      });

      await tx.chat_members.createMany({
        data: params.memberUserIds.map((user_id) => ({
          room_id: room.id,
          tenant_id: params.tenant_id,
          user_id,
          role: user_id === params.createdBy ? 'admin' : 'member',
        })),
      });

      return room;
    });
  }

  async getRooms(tenant_id: string, user_id: string) {
    // Part 1: Efficient DIRECT name resolution
    const rooms = await this.prisma.chat_rooms.findMany({
      where: {
        tenant_id: tenant_id,
        chat_members: {
          some: { user_id: user_id },
        },
        deleted_at: null,
      },
      include: {
        chat_members: {
          include: {
            users: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                avatar_url: true
              }
            }
          }
        },
        _count: {
          select: { comms_chat_messages: true },
        },
      },
      orderBy: { updated_at: 'desc' },
      take: 100
    });

    return rooms.map((room: any) => {
      if (room.type === "DIRECT" && !room.name) {
        const other = room.members.find((m: any) => m.user_id !== user_id);
        if (!other?.user) {
          return { ...room, name: "Unknown Contact" };
        }

        const user = other.user;
        let displayName = "Unknown Contact";

        if (user.first_name || user.last_name) {
          displayName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
        } else {
          displayName = user.email;
        }

        return {
          ...room,
          name: displayName,
          avatar: user.avatarUrl || room.avatarUrl
        };
      }
      return room;
    });
  }

  async getMessages(tenant_id: string, roomId: string, filters: { limit?: number; cursor?: string }) {
    // Part 5: Cursor-based message pagination
    const limit = filters.limit ?? 50;

    const messages = await this.prisma.comms_chat_messages.findMany({
      where: { 
        room_id: roomId, 
        tenant_id: tenant_id, 
        deleted_at: null,
        created_at: filters.cursor ? { lt: new Date(filters.cursor) } : undefined
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        chat_reactions: true,
      }
    });

    // Enhance with sender names
    const items = await Promise.all(messages.map(async (msg: any) => {
      const user = await this.prisma.users.findUnique({
        where: { id: msg.sender_id },
        select: { first_name: true, last_name: true, avatar_url: true, email: true }
      });
      return {
        ...msg,
        senderName: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'Unknown User',
        senderAvatar: user?.avatar_url
      };
    }));

    return {
      messages: items,
      nextCursor: messages[messages.length - 1]?.created_at
    };
  }

  async sendMessage(params: {
    tenant_id: string;
    roomId: string;
    senderId: string;
    body: string;
    type?: string;
    attachments?: any;
    refModule?: string;
    refEntityId?: string;
  }) {
    return this.prisma.$transaction(async (tx: any) => {
      const message = await tx.comms_chat_messages.create({
        data: {
          id: uuidv4(),
          updated_at: new Date(),
          tenant_id: params.tenant_id,
          room_id: params.roomId,
          sender_id: params.senderId,
          body: params.body,
          type: params.type ?? 'text',
          attachments: params.attachments || null,
          ref_module: params.refModule || null,
          ref_entity_id: params.refEntityId || null,
          status: 'SENT'
        },
      });

      // Part 4: Cache last message on room
      await tx.chat_rooms.update({
        where: { id: params.roomId },
        data: {
          last_message_id: message.id,
          last_message_text: message.body,
          last_message_at: message.created_at,
          updated_at: message.created_at
        }
      });

      // Part 3: Scalable unread tracking
      await tx.chat_members.updateMany({
        where: {
          room_id: params.roomId,
          user_id: { not: params.senderId }
        },
        data: {
          unread_count: { increment: 1 }
        }
      });

      // Notify all members except sender
      const members = await tx.chat_members.findMany({
        where: { room_id: params.roomId, tenant_id: params.tenant_id }
      });
      
      const sender = await tx.users.findUnique({
        where: { id: params.senderId },
        select: { first_name: true, last_name: true }
      });
      const senderName = sender ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() : 'Unknown';

      for (const member of members) {
        if (member.user_id !== params.senderId) {
          const notif = await this.notificationService.createNotification({
            tenant_id: params.tenant_id,
            user_id: member.user_id,
            title: 'Secure Comms Message',
            message: `${senderName}: ${params.body.substring(0, 50)}${params.body.length > 50 ? '...' : ''}`,
            type: 'CHAT',
            link: '/core/chat',
            priority: 'NORMAL',
            event_reference_id: message.id,
          });

          await this.notificationGateway.broadcastNotification({
             tenant_id: params.tenant_id,
             user_id: member.user_id,
             notification: notif
          });
        }
      }

      return message;
    });
  }

  async markAsRead(roomId: string, user_id: string) {
    // Part 3: Reset unread count when room opened
    await this.prisma.chat_members.update({
      where: { room_id_user_id: { room_id: roomId, user_id: user_id } },
      data: {
        unread_count: 0,
        last_read_at: new Date()
      }
    });

    // Part 7: Mark messages as READ
    await this.prisma.comms_chat_messages.updateMany({
      where: {
        room_id: roomId,
        sender_id: { not: user_id },
        status: { not: 'READ' }
      },
      data: {
        status: 'READ',
        read_at: new Date()
      }
    });
  }

  async updateMessageStatus(messageId: string, status: 'DELIVERED' | 'READ') {
    const data: any = { status };
    if (status === 'DELIVERED') data.deliveredAt = new Date();
    if (status === 'READ') data.readAt = new Date();

    return this.prisma.comms_chat_messages.update({
      where: { id: messageId },
      data
    });
  }
}
