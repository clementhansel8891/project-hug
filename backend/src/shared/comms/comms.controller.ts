import { Controller, Get, Post, Patch, Delete, Body, Query, Req, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { BulletinService } from './bulletin.service';
import { MailService } from './mail.service';
import { ChatService } from './chat.service';
import { NotificationService } from './notification.service';
import { TenantGuard } from '../guards/tenant.guard';
import { PaginationPipe, PaginationParams } from '../pipes/pagination.pipe';
import { CacheInterceptor, CacheTTL, CacheInvalidationHelper } from '../cache';

@Controller('comms')
@UseGuards(TenantGuard)
export class CommsController {
  constructor(
    private readonly bulletinService: BulletinService,
    private readonly mailService: MailService,
    private readonly chatService: ChatService,
    private readonly notificationService: NotificationService,
    private readonly cacheHelper: CacheInvalidationHelper,
  ) {}

  // Bulletin Endpoints
  @Get('bulletin')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getBulletins(
    @Req() req: any,
    @Query(PaginationPipe) pagination: PaginationParams,
    @Query('category') category?: string,
    @Query('authorId') authorId?: string,
  ) {
    const tenant_id = req.tenantContext?.tenant_id;
    return this.bulletinService.getPostsPaginated(tenant_id, pagination, { category, authorId });
  }

  @Get('bulletin/:id')
  async getBulletinDetail(@Req() req: any, @Param('id') id: string) {
    const tenant_id = req.tenantContext?.tenant_id;
    return this.bulletinService.getPostById(tenant_id, id);
  }

  @Post('bulletin')
  async createBulletin(@Req() req: any, @Body() body: any) {
    const context = req.tenantContext;
    const result = await this.bulletinService.createPost({
      ...body,
      tenant_id: context.tenant_id,
      authorId: context.user_id,
    });
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Patch('bulletin/:id')
  async updateBulletin(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const tenant_id = req.tenantContext?.tenant_id;
    const result = await this.bulletinService.updatePost(tenant_id, id, body);
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Delete('bulletin/:id')
  async deleteBulletin(@Req() req: any, @Param('id') id: string) {
    const tenant_id = req.tenantContext?.tenant_id;
    const result = await this.bulletinService.deletePost(tenant_id, id);
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Post('bulletin/:id/react')
  async reactToBulletin(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const context = req.tenantContext;
    const result = await this.bulletinService.toggleReaction({
      postId: id,
      tenant_id: context.tenant_id,
      user_id: context.user_id,
      type: body.type || 'LIKE',
    });
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Post('bulletin/:id/comment')
  async commentOnBulletin(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const context = req.tenantContext;
    const result = await this.bulletinService.addComment({
      postId: id,
      tenant_id: context.tenant_id,
      authorId: context.user_id,
      body: body.body,
    });
    await this.cacheHelper.invalidateAll();
    return result;
  }

  // Bulletin Categories
  @Get('bulletin-categories')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  async getBulletinCategories(@Req() req: any) {
    const tenant_id = req.tenantContext?.tenant_id;
    return this.bulletinService.getCategories(tenant_id);
  }

  @Post('bulletin-categories')
  async createBulletinCategory(@Req() req: any, @Body() body: any) {
    const tenant_id = req.tenantContext?.tenant_id;
    const result = await this.bulletinService.createCategory(tenant_id, body);
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Patch('bulletin-categories/:id')
  async updateBulletinCategory(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const tenant_id = req.tenantContext?.tenant_id;
    const result = await this.bulletinService.updateCategory(tenant_id, id, body);
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Delete('bulletin-categories/:id')
  async deleteBulletinCategory(@Req() req: any, @Param('id') id: string) {
    const tenant_id = req.tenantContext?.tenant_id;
    const result = await this.bulletinService.deleteCategory(tenant_id, id);
    await this.cacheHelper.invalidateAll();
    return result;
  }

  // Mail Endpoints
  @Get('mail/messages')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getMailMessages(
    @Req() req: any,
    @Query(PaginationPipe) pagination: PaginationParams,
    @Query('folder') folder?: string,
  ) {
    const context = req.tenantContext;
    return this.mailService.getMessagesPaginated(context.tenant_id, context.user_id, folder || 'inbox', pagination);
  }

  @Get('mail/accounts')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  async getMailAccounts(@Req() req: any) {
    const context = req.tenantContext;
    return this.mailService.getMailAccounts(context.tenant_id, context.user_id);
  }

  @Post('mail/send')
  async sendMail(@Req() req: any, @Body() body: any) {
    const context = req.tenantContext;

    // Normalize input: accept both { to, body } and { toAddresses, bodyText } formats
    const toAddresses = body.toAddresses || (body.to ? (Array.isArray(body.to) ? body.to : [body.to]) : []);
    const bodyText = body.bodyText || body.body || '';
    const bodyHtml = body.bodyHtml || body.body_html;
    const subject = body.subject || '(No Subject)';
    const ccAddresses = body.ccAddresses || body.cc || [];

    const result = await this.mailService.sendMail({
      toAddresses,
      ccAddresses: Array.isArray(ccAddresses) ? ccAddresses : [ccAddresses],
      subject,
      bodyText,
      bodyHtml,
      tenant_id: context.tenant_id,
      user_id: context.user_id,
    });
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Patch('mail/:id/star')
  async toggleMailStar(@Req() req: any, @Param('id') id: string) {
    const tenant_id = req.tenantContext?.tenant_id;
    const result = await this.mailService.toggleStar(tenant_id, id);
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Patch('mail/:id/read')
  async markMailAsRead(@Req() req: any, @Param('id') id: string) {
    const tenant_id = req.tenantContext?.tenant_id;
    const result = await this.mailService.markAsRead(tenant_id, id);
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Delete('mail/:id')
  async deleteMail(@Req() req: any, @Param('id') id: string) {
    const tenant_id = req.tenantContext?.tenant_id;
    const result = await this.mailService.deleteMail(tenant_id, id);
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Patch('mail/:id/restore')
  async restoreMail(@Req() req: any, @Param('id') id: string) {
    const tenant_id = req.tenantContext?.tenant_id;
    const result = await this.mailService.restoreMail(tenant_id, id);
    await this.cacheHelper.invalidateAll();
    return result;
  }

  // Chat Endpoints
  @Get('chat/rooms')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getChatRooms(@Req() req: any) {
    const context = req.tenantContext;
    return this.chatService.getRooms(context.tenant_id, context.user_id);
  }

  @Get('chat/rooms/:roomId/messages')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getChatMessages(@Req() req: any, @Param('roomId') roomId: string, @Query() filters: any) {
    const tenant_id = req.tenantContext?.tenant_id;
    return this.chatService.getMessages(tenant_id, roomId, filters);
  }

  @Post('chat/rooms')
  async createChatRoom(@Req() req: any, @Body() body: any) {
    const context = req.tenantContext;
    const memberUserIds = body.memberUserIds || [context.user_id];
    if (!memberUserIds.includes(context.user_id)) {
      memberUserIds.push(context.user_id);
    }
    
    const result = await this.chatService.createRoom({
      ...body,
      tenant_id: context.tenant_id,
      createdBy: context.user_id,
      memberUserIds,
    });
    await this.cacheHelper.invalidateAll();
    return result;
  }

  // Notification Endpoints
  @Get('notifications')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getNotifications(
    @Req() req: any,
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    const context = req.tenantContext;
    return this.notificationService.getNotificationsPaginated(context.tenant_id, context.user_id, pagination);
  }

  @Patch('notifications/:id/read')
  async markNotificationRead(@Req() req: any, @Param('id') id: string) {
    const context = req.tenantContext;
    const result = await this.notificationService.markAsRead(context.tenant_id, id);
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Post('notifications/read-all')
  async markAllNotificationsRead(@Req() req: any) {
    const context = req.tenantContext;
    const result = await this.notificationService.markAllAsRead(context.tenant_id, context.user_id);
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Get('notifications/counts')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getUnreadCounts(@Req() req: any) {
    const context = req.tenantContext;
    return this.notificationService.getUnreadCounts(context.tenant_id, context.user_id);
  }
}
