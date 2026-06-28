import { Controller, Get, Delete, Query, Req, UseInterceptors } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { LogQueryDto } from './dto/log-query.dto';
import { CacheInterceptor, CacheTTL } from '../cache';

@Controller('logs')
export class LoggerController {
  constructor(private readonly loggerService: LoggerService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  query(@Req() req: any, @Query() filters: LogQueryDto) {
    const tenant_id = req.tenantContext?.tenant_id ?? req.tenant_id;
    return this.loggerService.query(tenant_id, filters);
  }

  @Delete('prune')
  prune(@Query('days') days: string) {
    return this.loggerService.prune(Number(days) || 90).then((count) => ({ pruned: count }));
  }
}
