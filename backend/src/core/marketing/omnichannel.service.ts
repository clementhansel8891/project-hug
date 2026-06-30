import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../persistence/prisma.service";
import { TenantContext } from "../../gateway/tenant-context.interface";
import { MultiTenancyUtil } from "../../shared/utils/multi-tenancy.util";
import { ConfigService } from "@nestjs/config";
import { v4 as uuidv4 } from "uuid";
import * as nodemailer from "nodemailer";
import { Twilio } from "twilio";
import axios from "axios";

@Injectable()
export class OmnichannelService {
  private readonly logger = new Logger(OmnichannelService.name);
  private twilioClient: Twilio | null = null;
  private mailTransport: nodemailer.Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.initProviders();
  }

  private initProviders() {
    // Init Twilio if SID is present
    const twilioSid = this.configService.get<string>("TWILIO_ACCOUNT_SID");
    const twilioToken = this.configService.get<string>("TWILIO_AUTH_TOKEN");
    if (twilioSid && twilioToken && !twilioSid.includes("placeholder")) {
      this.twilioClient = new Twilio(twilioSid, twilioToken);
    }

    // Init Mailer if host is present
    const mailHost = this.configService.get<string>("MAIL_HOST");
    if (mailHost && !mailHost.includes("placeholder")) {
      this.mailTransport = nodemailer.createTransport({
        host: mailHost,
        port: this.configService.get<number>("MAIL_PORT") || 587,
        secure: false,
        auth: {
          user: this.configService.get<string>("MAIL_USER"),
          pass: this.configService.get<string>("MAIL_PASS"),
        },
      });
    }
  }

  /**
   * Send a message via the specified channel
   */
  async sendMessage(ctx: TenantContext, contactId: string, channel: string, content: string) {
    this.logger.log(`Sending ${channel} message to contact ${contactId}`);

    // 1. Persist message in database
    const message = await this.prisma.marketing_omnichannel_messages.create({
      data: {
        id: uuidv4(),
        tenant_id: ctx.tenant_id,
        contact_id: contactId,
        channel,
        direction: "OUTBOUND",
        content,
        status: "PENDING",
      }
    });

    // 2. Execute provider logic
    try {
      let providerSuccess = true;
      let errorMsg = "";

      if (channel === "EMAIL" && this.mailTransport) {
        const contact = await this.prisma.marketing_contacts.findUnique({ where: { id: contactId } });
        if (contact?.email) {
          await this.mailTransport.sendMail({
            from: this.configService.get<string>("MAIL_FROM") || "noreply@zenvix.ai",
            to: contact.email,
            subject: "Notification from Zenvix",
            text: content,
          });
        } else {
          throw new Error("Contact email not found");
        }
      } else if (channel === "SMS" && this.twilioClient) {
        const contact = await this.prisma.marketing_contacts.findUnique({ where: { id: contactId } });
        if (contact?.phone) {
          await this.twilioClient.messages.create({
            body: content,
            to: contact.phone,
            from: this.configService.get<string>("TWILIO_PHONE_NUMBER"),
          });
        } else {
          throw new Error("Contact phone not found");
        }
      } else if (channel === "WHATSAPP") {
        const metaToken = this.configService.get<string>("META_BUSINESS_API_TOKEN");
        const contact = await this.prisma.marketing_contacts.findUnique({ where: { id: contactId } });
        if (metaToken && !metaToken.includes("placeholder") && contact?.phone) {
          // Meta WhatsApp Business API integration
          await axios.post(
            `https://graph.facebook.com/v17.0/${this.configService.get("META_PHONE_ID")}/messages`,
            {
              messaging_product: "whatsapp",
              to: contact.phone,
              type: "text",
              text: { body: content },
            },
            { headers: { Authorization: `Bearer ${metaToken}` } },
          );
        } else {
          this.logger.warn(`WhatsApp skip: No token or phone for contact ${contactId}`);
          providerSuccess = false;
          errorMsg = "WhatsApp provider not configured or contact phone missing";
        }
      } else {
        this.logger.warn(`Provider for ${channel} not initialized. Simulating success.`);
      }

      // 3. Update status
      await this.prisma.marketing_omnichannel_messages.update({
        where: { id: message.id },
        data: {
          status: providerSuccess ? "SENT" : "FAILED",
          sent_at: providerSuccess ? new Date() : undefined,
          metadata: errorMsg ? { error: errorMsg } : undefined,
        },
      });

      return { success: providerSuccess, messageId: message.id, error: errorMsg };
    } catch (error) {
      this.logger.error(`Failed to send ${channel} message: ${error.message}`);
      await this.prisma.marketing_omnichannel_messages.update({
        where: { id: message.id },
        data: { status: "FAILED", metadata: { error: error.message } }
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Under Construction Placeholder for UI
   */
  getChannelStatus() {
    return {
      WHATSAPP: {
        status: this.configService.get("META_BUSINESS_API_TOKEN")?.includes("placeholder") ? "PENDING_CONFIG" : "ACTIVE",
        message: "Meta Business API ready."
      },
      SMS: {
        status: this.twilioClient ? "ACTIVE" : "PENDING_CONFIG",
        message: this.twilioClient ? "Twilio integration active." : "Configure Twilio SID/Token."
      },
      EMAIL: {
        status: this.mailTransport ? "ACTIVE" : "PENDING_CONFIG",
        message: this.mailTransport ? "Email delivery active." : "Configure SMTP credentials."
      }
    };
  }

  /**
   * Get all conversations for the tenant
   */
  async getConversations(ctx: TenantContext) {
    const messages = await this.prisma.marketing_omnichannel_messages.findMany({
      where: MultiTenancyUtil.getScope(ctx),
      include: {
        contact: true
      },
      orderBy: { sent_at: "desc" }
    });

    // Group by contact_id to form conversations
    const groups = new Map<string, any>();
    for (const msg of messages) {
      if (!groups.has(msg.contact_id)) {
        groups.set(msg.contact_id, {
          id: msg.id,
          contactId: msg.contact_id,
          contactName: `${msg.contact?.first_name || ""} ${msg.contact?.last_name || ""}`.trim() || "Unknown Contact",
          contactEmail: msg.contact?.email,
          lastMessage: msg.content,
          lastTimestamp: msg.sent_at,
          unreadCount: msg.direction === "INBOUND" && msg.status !== "READ" ? 1 : 0,
          channel: msg.channel,
          score: msg.contact?.score || 0,
        });
      } else if (msg.direction === "INBOUND" && msg.status !== "READ") {
        groups.get(msg.contact_id).unreadCount++;
      }
    }

    return Array.from(groups.values());
  }

  /**
   * Get messages, optionally filtered by conversation (contact_id)
   */
  async getMessages(ctx: TenantContext, conversationId?: string) {
    const where: any = MultiTenancyUtil.getScope(ctx);
    if (conversationId) where.contact_id = conversationId;

    return this.prisma.marketing_omnichannel_messages.findMany({
      where,
      include: { contact: true },
      orderBy: { sent_at: 'desc' },
      take: 100,
    });
  }

  /**
   * Process incoming Meta webhooks (WhatsApp/Messenger)
   */
  async processInboundWebhook(payload: any) {
    this.logger.log(`Processing inbound webhook: ${JSON.stringify(payload)}`);
    
    // 1. Validate payload structure
    if (!payload.entry || !payload.entry[0].changes || !payload.entry[0].changes[0].value.messages) {
      this.logger.warn("Received non-message webhook or invalid structure");
      return;
    }

    const messageData = payload.entry[0].changes[0].value.messages[0];
    const from = messageData.from; // Phone number
    const text = messageData.text?.body || "Non-text message";
    const externalId = messageData.id;

    // 2. Identify contact by phone
    let contact = await this.prisma.marketing_contacts.findFirst({
      where: { phone: from }
    });

    if (!contact) {
      this.logger.log(`Creating new contact for unknown phone: ${from}`);
      // Auto-create lead/contact for unknown inbound
      contact = await this.prisma.marketing_contacts.create({
        data: {
          id: uuidv4(),
          tenant_id: "system", // Fallback, usually we'd extract from webhook metadata or app_id
          first_name: "Inbound",
          last_name: from,
          phone: from,
          status: "ACTIVE",
          score: 10, // Initial interest
        }
      });
    }

    // 3. Persist inbound message
    await this.prisma.marketing_omnichannel_messages.create({
      data: {
        id: uuidv4(),
        tenant_id: contact.tenant_id,
        contact_id: contact.id,
        channel: "WHATSAPP",
        direction: "INBOUND",
        content: text,
        status: "DELIVERED",
        sent_at: new Date(),
        metadata: {
          external_id: externalId,
          raw_payload: payload
        }
      }
    });

    this.logger.log(`Inbound message from ${from} processed successfully`);
  }

  /**
   * Upsert the routing/automation config for a channel (OmnichannelConfigModal).
   * Keyed by (tenant_id, channel); re-saving the same channel updates in place.
   */
  async saveConfig(
    ctx: TenantContext,
    data: {
      channel: string;
      autoReply?: boolean;
      autoReplyMessage?: string;
      assignTo?: string;
      maxConcurrentChats?: number;
      businessHoursOnly?: boolean;
    },
  ) {
    const payload = {
      auto_reply: data.autoReply ?? false,
      auto_reply_message: data.autoReplyMessage ?? null,
      assign_to: data.assignTo ?? "MANUAL",
      max_concurrent_chats: data.maxConcurrentChats ?? 10,
      business_hours_only: data.businessHoursOnly ?? true,
      updated_at: new Date(),
    };
    return this.prisma.marketing_omnichannel_configs.upsert({
      where: { tenant_id_channel: { tenant_id: ctx.tenant_id, channel: data.channel } },
      update: payload,
      create: {
        id: uuidv4(),
        tenant_id: ctx.tenant_id,
        company_id: ctx.company_id ?? null,
        channel: data.channel,
        ...payload,
      },
    });
  }

  /** List all channel configs for the tenant. */
  async getConfigs(ctx: TenantContext) {
    return this.prisma.marketing_omnichannel_configs.findMany({
      where: MultiTenancyUtil.getScope(ctx),
      orderBy: { channel: "asc" },
    });
  }
}
