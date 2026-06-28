import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { LicenseService } from './license.service';
import { PaginationPipe, PaginationParams } from '../pipes/pagination.pipe';
import { CacheInterceptor, CacheTTL, CacheInvalidationHelper } from '../cache';

@Controller('license')
export class LicenseController {
  constructor(
    private readonly licenseService: LicenseService,
    private readonly cacheHelper: CacheInvalidationHelper,
  ) {}

  @Get('my-modules')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  async getMyModules(
    @Req() req: any,
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    return this.licenseService.getTenantLicensesPaginated(req.tenant_id, pagination);
  }

  @Get('check/:moduleCode')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async checkLicense(@Req() req: any, @Param('moduleCode') moduleCode: string) {
    return this.licenseService.getLicense(req.tenant_id, moduleCode);
  }

  @Post('toggle/:moduleCode')
  async toggleModule(
    @Req() req: any,
    @Param('moduleCode') moduleCode: string,
    @Body('enabled') enabled: boolean,
  ) {
    const result = await this.licenseService.toggleModule(
      req.tenant_id,
      moduleCode,
      enabled,
      req.user.user_id,
    );
    await this.cacheHelper.invalidateAll();
    return result;
  }
}
