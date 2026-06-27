import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../persistence/prisma.service';

/** Available modules that can be granted to JV partners */
export const JV_MODULES = [
  'expenses',
  'procurement',
  'inventory',
  'pos',
  'sales',
  'finance_read',
  'finance_write',
] as const;

export type JVModuleKey = typeof JV_MODULES[number];
export type JVAccessLevel = 'none' | 'read' | 'write' | 'manage';

export interface SetPermissionDto {
  participant_id: string;
  module: JVModuleKey;
  access_level: JVAccessLevel;
}

export interface BulkPermissionDto {
  participant_id: string;
  permissions: { module: JVModuleKey; access_level: JVAccessLevel }[];
}

/**
 * Default permissions based on JV participant role.
 */
const DEFAULT_PERMISSIONS: Record<string, Record<JVModuleKey, JVAccessLevel>> = {
  OPERATOR: {
    expenses: 'write',
    procurement: 'write',
    inventory: 'write',
    pos: 'write',
    sales: 'read',
    finance_read: 'read',
    finance_write: 'none',
  },
  NON_OPERATOR: {
    expenses: 'write',    // Can submit expenses even if passive
    procurement: 'read',
    inventory: 'read',
    pos: 'none',
    sales: 'read',
    finance_read: 'read',
    finance_write: 'none',
  },
};

@Injectable()
export class JVPermissionService {
  private readonly logger = new Logger(JVPermissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initialize default permissions for a newly accepted participant.
   */
  async initializeDefaults(participantId: string, role: string) {
    const defaults = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.NON_OPERATOR;

    const data = Object.entries(defaults).map(([module, access_level]) => ({
      participant_id: participantId,
      module,
      access_level,
    }));

    await this.prisma.finance_jv_permissions.createMany({
      data,
      skipDuplicates: true,
    });

    this.logger.log(`Initialized ${data.length} default permissions for participant ${participantId} (role: ${role})`);
  }

  /**
   * Set a single permission for a participant.
   */
  async setPermission(dto: SetPermissionDto) {
    if (!JV_MODULES.includes(dto.module as any)) {
      throw new BadRequestException(`Invalid module: ${dto.module}. Valid modules: ${JV_MODULES.join(', ')}`);
    }

    await this.prisma.finance_jv_permissions.upsert({
      where: {
        participant_id_module: {
          participant_id: dto.participant_id,
          module: dto.module,
        },
      },
      create: {
        participant_id: dto.participant_id,
        module: dto.module,
        access_level: dto.access_level,
      },
      update: {
        access_level: dto.access_level,
      },
    });

    return { participant_id: dto.participant_id, module: dto.module, access_level: dto.access_level };
  }

  /**
   * Set multiple permissions at once for a participant.
   */
  async setBulkPermissions(dto: BulkPermissionDto) {
    const results = await Promise.all(
      dto.permissions.map(p =>
        this.setPermission({
          participant_id: dto.participant_id,
          module: p.module,
          access_level: p.access_level,
        })
      )
    );
    return results;
  }

  /**
   * Get all permissions for a participant.
   */
  async getPermissions(participantId: string) {
    const perms = await this.prisma.finance_jv_permissions.findMany({
      where: { participant_id: participantId },
    });

    // Fill in missing modules with 'none'
    const permMap: Record<string, JVAccessLevel> = {};
    for (const m of JV_MODULES) {
      permMap[m] = 'none';
    }
    for (const p of perms) {
      permMap[p.module] = p.access_level as JVAccessLevel;
    }

    return permMap;
  }

  /**
   * Check if a participant has the required access level for a module.
   */
  async checkAccess(participantId: string, module: string, requiredLevel: JVAccessLevel): Promise<boolean> {
    const perm = await this.prisma.finance_jv_permissions.findUnique({
      where: {
        participant_id_module: {
          participant_id: participantId,
          module,
        },
      },
    });

    if (!perm) return false;

    const levels: JVAccessLevel[] = ['none', 'read', 'write', 'manage'];
    const currentIndex = levels.indexOf(perm.access_level as JVAccessLevel);
    const requiredIndex = levels.indexOf(requiredLevel);

    return currentIndex >= requiredIndex;
  }
}
