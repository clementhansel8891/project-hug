import { TenantContext } from "../../../gateway/tenant-context.interface";
import { MultiTenancyUtil } from "../../../shared/utils/multi-tenancy.util";
import { Injectable } from "@nestjs/common";
import { it_devices as PrismaDevice, it_settings as PrismaITSetting } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { PrismaService } from "../../../persistence/prisma.service";
import { RegisterDeviceDto } from "../dto/register-device.dto";
import { UpdateSettingDto } from "../dto/update-setting.dto";
import { Device } from "../entities/device.entity";
import { Setting } from "../entities/setting.entity";
import { IITSettingsRepository } from "./it-settings.repository.interface";
import { mapPrismaError } from "../../_shared/errors/prisma-error.mapper";

@Injectable()
export class ITSettingsDbRepository extends IITSettingsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getDevices(ctx: TenantContext, location_id?: string): Promise<Device[]> {
    const devices = await this.prisma.it_devices.findMany({
      where: {
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        ...(location_id ? { location_id } : {}),
      },
    });

    return devices.map((d: PrismaDevice) => ({
      id: d.id,
      tenant_id: d.tenant_id,
      location_id: d.location_id || "",
      deviceType: d.type as any,
      deviceName: d.name,
      ip_address: (d.metadata as any)?.ip_address || undefined,
      macAddress: (d.metadata as any)?.macAddress || undefined,
      status: d.status.toLowerCase() as any,
      lastSeen: d.last_heartbeat || d.updated_at || d.created_at,
      metadata: (d.metadata as any) || {},
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));
  }

  async registerDevice(ctx: TenantContext,
    data: RegisterDeviceDto,
  ): Promise<Device> {
    const created = await this.prisma.it_devices.create({
      data: {
          updated_at: new Date(),
        id: uuidv4(),

        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        location_id: data.location_id,
        type: data.deviceType,
        name: data.deviceName,
        connection: "LAN",
        status: "ONLINE",
        metadata: {
          ip_address: data.ip_address,
          macAddress: data.macAddress,
        },
      },
    });

    return {
      id: created.id,
      tenant_id: created.tenant_id,
      location_id: created.location_id || "",
      deviceType: created.type as any,
      deviceName: created.name,
      ip_address: (created.metadata as any)?.ip_address || undefined,
      macAddress: (created.metadata as any)?.macAddress || undefined,
      status: "online",
      lastSeen: created.last_heartbeat || created.updated_at || created.created_at,
      metadata: (created.metadata as any) || {},
      created_at: created.created_at,
      updated_at: created.updated_at,
    };
  }

  async updateDeviceStatus(ctx: TenantContext,
    device_id: string,
    status: string,
  ): Promise<Device> {
    const updated = await this.prisma.it_devices.update({
      where: { id: device_id, tenant_id: ctx.tenant_id },
      data: { status },
    });

    return {
      id: updated.id,
      tenant_id: updated.tenant_id,
      location_id: updated.location_id || "",
      deviceType: updated.type as any,
      deviceName: updated.name,
      ip_address: (updated.metadata as any)?.ip_address || undefined,
      macAddress: (updated.metadata as any)?.macAddress || undefined,
      status: updated.status.toLowerCase() as any,
      lastSeen: updated.last_heartbeat || updated.updated_at || updated.created_at,
      metadata: (updated.metadata as any) || {},
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };
  }

  async getSettings(ctx: TenantContext, category?: string): Promise<Setting[]> {
    const settings = await this.prisma.it_settings.findMany({
      where: {
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        ...(category ? { category } : {}),
      },
    });

    return settings.map((s: PrismaITSetting) => ({
      id: s.id,
      tenant_id: s.tenant_id,
      key: s.key,
      value: s.value,
      category: s.category as any,
      isPublic: s.is_public,
      description: s.description || undefined,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
  }

  async getSetting(ctx: TenantContext, key: string): Promise<Setting | null> {
    const setting = await this.prisma.it_settings.findUnique({
      where: { tenant_id_key: { tenant_id: ctx.tenant_id, key } },
    });

    if (!setting) return null;

    return {
      id: setting.id,
      tenant_id: setting.tenant_id,
      key: setting.key,
      value: setting.value,
      category: setting.category as any,
      isPublic: setting.is_public,
      description: setting.description || undefined,
      created_at: setting.created_at,
      updated_at: setting.updated_at,
    };
  }

  async updateSetting(ctx: TenantContext,
    key: string,
    data: UpdateSettingDto,
  ): Promise<Setting> {
    try {
      const updated = await this.prisma.it_settings.upsert({
        where: { tenant_id_key: { tenant_id: ctx.tenant_id, key } },
        update: {
          value: data.value,
          category: data.category,
          is_public: data.isPublic,
          description: data.description,
        },
        create: {
          tenant_id: ctx.tenant_id,
          company_id: ctx.company_id || undefined,
          key,
          value: data.value,
          category: data.category || "general",
          is_public: data.isPublic || false,
          description: data.description,
        },
      });

      return {
        id: updated.id,
        tenant_id: updated.tenant_id,
        key: updated.key,
        value: updated.value,
        category: updated.category as any,
        isPublic: updated.is_public,
        description: updated.description || undefined,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      };
    } catch (error) {
      mapPrismaError(error, 'ITSetting');
    }
  }
}
