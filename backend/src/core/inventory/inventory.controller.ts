// @ts-nocheck
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "../../shared/roles";
import { Request, Response } from "express";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as path from "path";
import * as fs from "fs";
import { NotFoundException, BadRequestException, PayloadTooLargeException } from "@nestjs/common";
import { TenantContext } from "../../gateway/tenant-context.interface";
import { TenantInterceptor } from "../../gateway/tenant.interceptor";
import { TenantGuard } from "../../shared/guards/tenant.guard";
import { ModuleStateGuard } from "../auth/guards/module-state.guard";
import { BranchGatingGuard } from "../auth/guards/branch-gating.guard";
import { InventoryRolesGuard } from "./guards/inventory-roles.guard";
import {
  InventoryRole,
  RequireInventoryRole,
} from "./guards/inventory-role.decorator";
import { RequiredModule } from "../../shared/decorators/required-module.decorator";
import { CreateAdjustmentDto } from "./dto/create-adjustment.dto";
import { CreateItemDto } from "./dto/create-item.dto";
import { UpdateItemDto } from "./dto/update-item.dto";
import { CreateMovementDto } from "./dto/create-movement.dto";
import { StockAdjustmentDto } from "./dto/stock-adjustment.dto";
import { StockIntakeDto } from "./dto/stock-intake.dto";
import { TransferStockDto } from "./dto/transfer-stock.dto";
import { ImportItemDto } from "./dto/import-item.dto";
import { CreateMovementRequestDto } from "./dto/create-movement-request.dto";
import { CreateAgenticEventDto } from "./dto/create-agentic-event.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { InventoryService } from "./inventory.service";
import { FileProcessingService } from "../../shared/file-processing/file-processing.service";
import { AuditService } from "../../shared/audit/audit.service";
import { SkuGeneratorService } from "./sku-generator.service";
import { LabelTemplateService } from "./label-template.service";
import { ItemImageService } from "./item-image.service";
import { v4 as uuidv4 } from "uuid";
import { PrismaService } from "../../persistence/prisma.service";
import { isModuleActive } from "../../shared/helpers/module-active.helper";
import { PaginationPipe, PaginationParams } from "../../shared/pipes/pagination.pipe";
import { CacheInterceptor, CacheTTL, CacheInvalidationHelper } from "../../shared/cache";

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}

@Controller('inventory')
@UseInterceptors(TenantInterceptor)
@UseGuards(
  ModuleStateGuard,
  BranchGatingGuard,
  TenantGuard,
  InventoryRolesGuard,
)
@RequiredModule("inventory")
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly skuGenerator: SkuGeneratorService,
    private readonly labelTemplateService: LabelTemplateService,
    private readonly fileProcessingService: FileProcessingService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly itemImageService: ItemImageService,
    private readonly cacheHelper: CacheInvalidationHelper,
  ) {}

  @Get("dashboard")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getDashboard(
    @Req() request: RequestWithTenant,
    @Query("location_id") location_id?: string
  ) {
    const { tenant_id: tenant_id } = request.tenantContext;
    const dashboardData = await this.inventoryService.getDashboard(request.tenantContext, location_id);

    const moduleContributions: any = {};
    if (await isModuleActive(this.prisma, tenant_id, "retail")) {
      const activeStores = await this.prisma.stores.findMany({
        where: { tenant_id: tenant_id, deleted_at: null },
        select: { location_id: true },
      });
      const storeLocationIds = activeStores
        .map((s: any) => s.location_id)
        .filter(Boolean);

      const storeInventoryAgg = await this.prisma.stock_levels.aggregate({
        where: { tenant_id: tenant_id, location_id: { in: storeLocationIds } },
        _sum: { on_hand: true },
      });

      const pendingStockTransfers =
        await this.prisma.procurement_requisitions.count({
          where: {
            tenant_id: tenant_id,
            status: "SUBMITTED",
            department_id: { in: storeLocationIds }, // legacy store transfer references location ids
          },
        });

      moduleContributions.retail = {
        store_inventory_count: storeInventoryAgg._sum.on_hand || 0,
        pending_store_transfers: pendingStockTransfers,
      };
    }

    return {
      success: true,
      tenant_id,
      data: {
        ...dashboardData,
        moduleContributions,
      },
    };
  }

  @Get("items")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getItems(
    @Req() request: RequestWithTenant,
    @Query("location_id") location_id?: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "30",
    @Query("search") search?: string,
    @Query("category_id") category_id?: string,
    @Query("status") status?: string,
    @Query("is_anomaly") is_anomaly?: string,
    @Query("sortBy") sortBy?: "name" | "quantity" | "created_at",
    @Query("sortOrder") sortOrder?: "asc" | "desc",
  ) {
    const { tenant_id } = request.tenantContext;
    
    // JV auto-scope: when in JV context and no explicit location_id, resolve branch → location
    let effectiveLocationId = location_id;
    if (!effectiveLocationId && request.tenantContext.branch_id) {
      const branchStore = await this.prisma.stores.findFirst({
        where: { id: request.tenantContext.branch_id, tenant_id },
        select: { location_id: true },
      });
      if (branchStore) {
        effectiveLocationId = branchStore.location_id;
      }
    }
    
    const data = await this.inventoryService.getItems(
      request.tenantContext, 
      effectiveLocationId,
      parseInt(page),
      parseInt(limit),
      search,
      category_id,
      status,
      is_anomaly === "true",
      sortBy,
      sortOrder
    );
    const total = await this.inventoryService.countItems(request.tenantContext, effectiveLocationId, search, category_id, is_anomaly === "true");
    return { success: true, tenant_id, count: data.length, meta: { total }, data };
  }

  @Get("items/lookup")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async lookupItem(@Req() request: RequestWithTenant, @Query("barcode") barcode: string) {
    const { tenant_id: tenant_id } = request.tenantContext;
    const data = await this.inventoryService.lookupByBarcode(request.tenantContext, barcode);
    return { success: true, tenant_id, data };
  }

  @Post("items/:id/images")
  @RequireInventoryRole(InventoryRole.MANAGER)
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  }))
  async uploadImage(
    @Req() request: RequestWithTenant,
    @Param("id") itemId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new PayloadTooLargeException("File exceeds maximum size of 10MB");
    }
    const image = await this.itemImageService.uploadImage(
      request.tenantContext.tenant_id,
      itemId,
      file,
      request.tenantContext.user_id || "system",
    );
    await this.cacheHelper.invalidate(request);
    return {
      success: true,
      data: {
        imageId: image.id,
        url: image.url,
        primary: image.is_primary,
      },
    };
  }

  @Delete("items/:id/images/:imageId")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async deleteImage(
    @Req() request: RequestWithTenant,
    @Param("id") itemId: string,
    @Param("imageId") imageId: string,
  ) {
    return this.itemImageService.deleteImage(
      request.tenantContext.tenant_id,
      itemId,
      imageId,
      request.tenantContext.user_id || "system",
    );
  }

  @Put("items/:id/images/:imageId/primary")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async setPrimaryImage(
    @Req() request: RequestWithTenant,
    @Param("id") itemId: string,
    @Param("imageId") imageId: string,
  ) {
    const updated = await this.itemImageService.setPrimaryImage(
      request.tenantContext.tenant_id,
      itemId,
      imageId,
      request.tenantContext.user_id || "system",
    );
    await this.cacheHelper.invalidate(request);
    return {
      success: true,
      message: "Primary image updated",
      data: {
        imageId: updated.id,
        url: updated.url,
        primary: updated.is_primary,
      },
    };
  }

  @Get("items/:id/images")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async listImages(
    @Req() request: RequestWithTenant,
    @Param("id") itemId: string,
  ) {
    // Verify item exists
    const item = await this.prisma.item_masters.findFirst({
      where: { id: itemId, tenant_id: request.tenantContext.tenant_id },
    });
    if (!item) {
      throw new NotFoundException(`Item ${itemId} not found`);
    }
    const images = await this.itemImageService.listImages(
      request.tenantContext.tenant_id,
      itemId,
    );
    return {
      success: true,
      data: images.map((img: any) => ({
        imageId: img.id,
        url: img.url,
        primary: img.is_primary,
      })),
    };
  }

  @Get("images/*path")
  async serveImage(
    @Param('path') pathParam: string | string[],
    @Req() request: Request,
    @Res() res: Response,
  ) {
    const marker = "/inventory/images/";
    const requestPath = request.path || request.url.split("?")[0] || "";
    const markerIndex = requestPath.indexOf(marker);
    const paramPath = Array.isArray(pathParam)
      ? pathParam.join("/")
      : pathParam || '';
    const fullPath =
      markerIndex >= 0
        ? requestPath.slice(markerIndex + marker.length)
        : paramPath;
    const imagePath = await this.itemImageService.getImagePath(fullPath);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(imagePath);
  }

  @Post("items")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async createItem(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateItemDto,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    return {
      success: true,
      tenant_id,
      message: "Inventory item created",
      data: await this.inventoryService.createItem(request.tenantContext, dto, user_id),
    };
  }

  @Post("items/batch-delete")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async batchDeleteItems(
    @Req() request: RequestWithTenant,
    @Body() body: { item_ids: string[] },
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    await this.inventoryService.batchDeleteItems(
      request.tenantContext,
      body.item_ids,
      user_id,
    );
    return {
      success: true,
      tenant_id,
      message: "Batch delete successful",
    };
  }

  @Delete("items/:id")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async deleteItem(
    @Req() request: RequestWithTenant,
    @Param("id") item_id: string,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    await this.inventoryService.softDeleteItem(request.tenantContext, item_id, user_id);
    await this.cacheHelper.invalidateAll();
    return {
      success: true,
      tenant_id,
      message: "Inventory item deleted",
    };
  }

  @Post(["items/import", "import"])
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = './uploads/imports';
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `data-${uniqueSuffix}${path.extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
  }))
  @RequireInventoryRole(InventoryRole.MANAGER)
  async importItems(
    @Req() request: RequestWithTenant,
    @UploadedFile() file: Express.Multer.File,
    @Body('location_id') locationId?: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    if (!file) {
      return { success: false, message: "No file uploaded" };
    }

    console.log(`[Import] Starting DATA import for file: ${file.originalname}, tenant: ${tenant_id}`);
    const job = await this.prisma.inventory_import_jobs.create({
      data: {
        tenant_id,
        user_id: user_id || 'system',
        type: 'DATA',
        filename: file.originalname,
        file_path: file.path,
        status: 'PENDING',
      },
    });

    // Start background processing
    this.inventoryService.processDataImportJob(job.id, request.tenantContext, locationId);

    return {
      success: true,
      message: "Import job initiated",
      jobId: job.id,
    };
  }

  @Post(["bulk-images", "import/images"])
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = './uploads/imports';
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `images-${uniqueSuffix}${path.extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB
  }))
  @RequireInventoryRole(InventoryRole.MANAGER)
  async importImages(
    @Req() request: RequestWithTenant,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    if (!file) {
      return { success: false, message: "No file uploaded" };
    }

    console.log(`[Import] Starting IMAGES import for file: ${file.originalname}, tenant: ${tenant_id}`);
    const job = await this.prisma.inventory_import_jobs.create({
      data: {
        tenant_id,
        user_id: user_id || 'system',
        type: 'IMAGES',
        filename: file.originalname,
        file_path: file.path,
        status: 'PENDING',
      },
    });

    // Start background processing
    this.inventoryService.processImageImportJob(job.id, request.tenantContext);

    return {
      success: true,
      message: "Image import job initiated",
      jobId: job.id,
    };
  }

  @Get("import/status/:jobId")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  @RequireInventoryRole(InventoryRole.CLERK)
  async getImportStatus(@Param("jobId") jobId: string, @Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const job = await this.prisma.inventory_import_jobs.findFirst({
      where: { id: jobId, tenant_id },
    });
    if (!job) throw new NotFoundException("Job not found");
    return job;
  }

  @Get("import/jobs/active")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getActiveImportJobs(@Req() request: RequestWithTenant) {
    return this.prisma.inventory_import_jobs.findMany({
      where: {
        tenant_id: request.tenantContext.tenant_id,
        status: "PROCESSING",
      },
      orderBy: { created_at: "desc" },
    });
  }

  @Get("import/jobs")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getAllImportJobs(@Req() request: RequestWithTenant) {
    return this.prisma.inventory_import_jobs.findMany({
      where: {
        tenant_id: request.tenantContext.tenant_id,
      },
      orderBy: { created_at: "desc" },
      take: 50,
    });
  }

  @Delete("import/jobs/:id")
  async abortImportJob(@Param("id") id: string, @Req() request: RequestWithTenant) {
    await this.inventoryService.cancelImportJob(id, request.tenantContext);
    await this.cacheHelper.invalidateAll();
    return { success: true, message: "Import job cancelled" };
  }


  @Get("items/template")
  async getTemplate(
    @Req() request: RequestWithTenant,
    @Res() res: Response,
  ) {
    const headers = [
      { header: "SKU", key: "sku", width: 20 },
      { header: "Name", key: "name", width: 40 },
      { header: "Category", key: "category", width: 20 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Barcode", key: "barcode", width: 20 },
      { header: "Description", key: "description", width: 40 },
      { header: "Base Price (Cost)", key: "base_price", width: 15 },
      { header: "Selling Price", key: "selling_price", width: 15 },
      { header: "Discount Rate", key: "discount_rate", width: 15 },
      { header: "Discount Type", key: "discount_type", width: 15 },
      { header: "Initial Quantity", key: "quantity", width: 15 },
      { header: "Location Name", key: "location", width: 25 },
      { header: "Tax Rate", key: "tax_rate", width: 10 },
      { header: "Active", key: "active", width: 10 },
      { header: "Pricing Tiers (JSON)", key: "pricing_tiers", width: 30 },

    ];

    const buffer = await this.fileProcessingService.generateExcel(
      [], // Empty data for template
      headers,
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=inventory_import_template.xlsx",
    );
    res.send(buffer);
  }

  @Post("items/batch-json")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async batchCreateItemsJson(
    @Req() request: RequestWithTenant,
    @Body() body: { items: any[] },
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    // Map UI fields to DTO fields if necessary, but batchCreateItems handles CreateItemDto[]
    // The UI sends: sku, name, category, barcode, base_price, uom, description, active
    const data = body.items.map((item) => ({
      ...item,
      // Ensure category is passed as string for SKU generation logic
      category: item.category,
      uom: item.uom || "pcs",
    }));

    const items = await this.inventoryService.batchCreateItems(
      request.tenantContext,
      data as CreateItemDto[],
      user_id,
    );

    return {
      success: true,
      tenant_id,
      message: `${items.length} items created successfully`,
      data: items,
    };
  }

  @Get("items/export")
  async exportItems(
    @Req() request: RequestWithTenant,
    @Res() res: Response,
    @Query("watermarkText") watermarkText?: string,
    @Query("wmX") wmX?: string,
    @Query("wmY") wmY?: string,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const items = await this.inventoryService.getItems(request.tenantContext);

    const traceId = uuidv4();
    const buffer = await this.fileProcessingService.generateExcel(
      items,
      [
        { header: "SKU", key: "sku", width: 20 },
        { header: "Name", key: "name", width: 40 },
        { header: "Category", key: "category", width: 20 },
        { header: "UOM", key: "uom", width: 10 },
        { header: "Active", key: "active", width: 10 },
      ],
      {
        traceId,
        watermark: watermarkText
          ? {
              text: watermarkText,
              position: { x: parseInt(wmX || "1"), y: parseInt(wmY || "1") },
            }
          : undefined,
      },
    );

    await this.auditService.log({
      tenant_id: tenant_id,
      user_id: request.tenantContext.user_id || "system",
      module: "INVENTORY",
      action: "EXPORT",
      entity_type: "ITEM",
      entity_id: "BATCH",
      metadata: {
        traceId,
        watermark: watermarkText,
      },
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=inventory_export_${tenant_id}.xlsx`,
    );
    res.send(buffer);
  }

  @Get("balances")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getBalances(
    @Req() request: RequestWithTenant,
    @Query("location_id") location_id?: string,
    @Query("department_id") department_id?: string,
    @Query("search") search?: string,
    @Query("category_id") category_id?: string,
    @Query("item_id") item_id?: string,
    @Query(PaginationPipe) pagination?: PaginationParams,
  ) {
    const { tenant_id } = request.tenantContext;
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 50;

    const [data, totalCount] = await Promise.all([
      this.inventoryService.getBalances(
        request.tenantContext,
        location_id,
        department_id,
        page,
        pageSize,
        search,
        category_id,
        item_id,
      ),
      this.inventoryService.countBalances(request.tenantContext, location_id, department_id, search, category_id, item_id),
    ]);

    return {
      data,
      totalCount,
      currentPage: page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  @Get("movements")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getMovements(
    @Req() request: RequestWithTenant,
    @Query('item_id') item_id?: string,
    @Query(PaginationPipe) pagination?: PaginationParams,
  ) {
    const { tenant_id } = request.tenantContext;
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 50;

    const [data, totalCount] = await Promise.all([
      this.inventoryService.getMovements(request.tenantContext, item_id, page, pageSize),
      this.inventoryService.countMovements(request.tenantContext, item_id),
    ]);

    return {
      data,
      totalCount,
      currentPage: page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  @Post("intake")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async intakeStock(
    @Req() request: RequestWithTenant,
    @Body() dto: StockIntakeDto,
  ) {
    const { tenant_id: tenant_id, location_id, user_id } = request.tenantContext;
    if (location_id && !dto.location_id) dto.location_id = location_id;
    return {
      success: true,
      tenant_id,
      message: "Stock intake recorded",
      data: await this.inventoryService.intakeStock(request.tenantContext, dto, user_id),
    };
  }


  @Post("transfer")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async transferStock(
    @Req() request: RequestWithTenant,
    @Body() dto: TransferStockDto,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    return {
      success: true,
      tenant_id,
      message: "Stock transfer recorded",
      data: await this.inventoryService.transferStock(request.tenantContext, dto, user_id),
    };
  }


  @Post("consume")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async consumeStock(
    @Req() request: RequestWithTenant,
    @Body() dto: any,
    @Query("correlation_id") correlation_id?: string,
  ) {
    const { tenant_id: tenant_id, location_id, user_id } = request.tenantContext;
    if (location_id && !dto.location_id) dto.location_id = location_id;
    return {
      success: true,
      tenant_id,
      message: "Stock consumption recorded",
      data: await this.inventoryService.consumeStock(
        request.tenantContext,
        dto,
        user_id,
        null,
        correlation_id,
      ),
    };
  }

  // --- Financial-Grade Reservation ---

  @Post("reserve")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async reserveStock(
    @Req() request: RequestWithTenant,
    @Body() dto: { product_id: string; location_id: string; quantity: number; reference_id: string; reference_type: string },
    @Query("correlation_id") correlation_id?: string,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    await this.inventoryService.reserveStock(request.tenantContext, dto, user_id || "system", correlation_id);
    return { success: true, message: "Stock reserved" };
  }

  @Post("release")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async releaseStock(
    @Req() request: RequestWithTenant,
    @Body() dto: { product_id: string; location_id: string; quantity: number; reference_id: string; reference_type: string },
    @Query("correlation_id") correlation_id?: string,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    await this.inventoryService.releaseStock(request.tenantContext, dto, user_id || "system", correlation_id);
    return { success: true, message: "Stock released" };
  }

  @Post("confirm-reservation")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async confirmReservation(
    @Req() request: RequestWithTenant,
    @Body() dto: { product_id: string; location_id: string; quantity: number; reference_id: string; reference_type: string },
    @Query("correlation_id") correlation_id?: string,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    await this.inventoryService.confirmReservation(request.tenantContext, dto, user_id || "system", correlation_id);
    return { success: true, message: "Reservation confirmed and stock consumed" };
  }

  // --- Multi-Step Transfer ---

  @Post("transfer/initiate")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async initiateTransfer(
    @Req() request: RequestWithTenant,
    @Body() dto: any,
    @Query("correlation_id") correlation_id?: string,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const result = await this.inventoryService.initiateTransfer(request.tenantContext, dto, user_id || "system", correlation_id);
    return { success: true, message: "Transfer initiated (In-Transit)", ...result };
  }

  @Post("transfer/complete")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async completeTransfer(
    @Req() request: RequestWithTenant,
    @Body() dto: any,
    @Query("correlation_id") correlation_id?: string,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const data = await this.inventoryService.completeTransfer(request.tenantContext, dto, user_id || "system", correlation_id);
    return { success: true, message: "Transfer completed (Received)", data };
  }

  // --- Stock Transfer Lifecycle (Grading to Production) ---

  @Get("stock-transfers")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getTransfers(@Req() request: RequestWithTenant) {
    const { tenant_id: tenant_id } = request.tenantContext;
    const data = await this.inventoryService.getAllTransfers(request.tenantContext);
    return { success: true, tenant_id, count: data.length, data };
  }

  @Get("stock-transfers/:id")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  @RequireInventoryRole(InventoryRole.CLERK)
  async getStockTransfer(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const data = await this.inventoryService.getTransfer(request.tenantContext, id);
    if (!data) throw new Error("Transfer not found");
    return { success: true, data };
  }

  @Post("stock-transfers")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async createStockTransfer(
    @Req() request: RequestWithTenant,
    @Body() dto: any,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const data = await this.inventoryService.createTransfer(request.tenantContext, dto, user_id || "system");
    return { success: true, tenant_id, message: "Stock transfer requested", data };
  }

  @Put("stock-transfers/:id/pick")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async pickStockTransfer(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const data = await this.inventoryService.pickTransfer(request.tenantContext, id, user_id || "system");
    return { success: true, tenant_id, message: "Transfer picked", data };
  }

  @Put("stock-transfers/:id/ship")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async shipStockTransfer(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() body: { tracking_number: string },
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const data = await this.inventoryService.shipTransfer(request.tenantContext, id, body.tracking_number, user_id || "system");
    return { success: true, tenant_id, message: "Transfer shipped (In-Transit)", data };
  }

  @Put("stock-transfers/:id/receive")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async receiveStockTransfer(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const data = await this.inventoryService.receiveTransfer(request.tenantContext, id, user_id || "system");
    return { success: true, tenant_id, message: "Transfer received", data };
  }

  @Post("snapshots")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async runSnapshot(
    @Req() request: RequestWithTenant,
    @Query("location_id") location_id?: string,
  ) {
    const { tenant_id: tenant_id } = request.tenantContext;
    await this.inventoryService.runStockSnapshot(request.tenantContext, location_id || "ALL");
    return { success: true, message: "Stock snapshot taken" };
  }


  @Get("generate-sku")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async generateSku(
    @Req() request: RequestWithTenant,
    @Query("category") category: string,
  ) {
    const { tenant_id: tenant_id } = request.tenantContext;
    const sku = await this.skuGenerator.generateSku(request.tenantContext, category);
    return { success: true, tenant_id, sku };
  }

  @Get("generate-barcode")
  async generateBarcode(
    @Req() request: RequestWithTenant,
    @Query("sku") sku: string,
  ) {
    const { tenant_id: tenant_id } = request.tenantContext;
    const barcode = this.skuGenerator.generateBarcode(request.tenantContext, sku);
    return { success: true, tenant_id, barcode };
  }

  @Get("label/:sku")
  async getLabel(
    @Req() request: RequestWithTenant,
    @Param("sku") sku: string,
    @Query("format") format: "html" | "zpl" = "html",
  ) {
    const { tenant_id: tenant_id } = request.tenantContext;

    // In a real scenario, we'd fetch the actual product data to populate the label
    // For this implementation, we'll derive it from the SKU or use defaults
    const labelData = {
      name: `Product ${sku}`,
      sku: sku,
      barcode: sku, // Usually barcode is the SKU or a separate field
      price: 29.99,
      unit: "pcs",
    };

    if (format === "zpl") {
      return {
        success: true,
        tenant_id,
        zpl: this.labelTemplateService.generateZPL(labelData),
      };
    }

    return {
      success: true,
      tenant_id,
      html: this.labelTemplateService.generateLabelHtml(labelData),
    };
  }

  @Get("items/pending")
  async getPendingItems(@Req() request: RequestWithTenant) {
    const { tenant_id: tenant_id } = request.tenantContext;
    const data = await this.inventoryService.getPendingItems(request.tenantContext);
    return { success: true, tenant_id, count: data.length, data };
  }

  @Put("items/:id/approve")
  async approveItem(
    @Req() request: RequestWithTenant,
    @Param("id") item_id: string,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const item = await this.inventoryService.approveItem(
      request.tenantContext,
      item_id,
      user_id || "system",
    );
    return {
      success: true,
      tenant_id,
      message: "Item approved and activated",
      data: item,
    };
  }

  @Put("items/:id/reject")
  async rejectItem(
    @Req() request: RequestWithTenant,
    @Param("id") item_id: string,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const item = await this.inventoryService.rejectItem(
      request.tenantContext,
      item_id,
      user_id || "system",
    );
    return {
      success: true,
      tenant_id,
      message: "Item rejected",
      data: item,
    };
  }

  @Post("movements/request")
  async createMovementRequest(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateMovementRequestDto,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    return {
      success: true,
      tenant_id,
      message: "Movement request created",
      data: await this.inventoryService.createMovementRequest(
        request.tenantContext,
        dto,
        user_id,
      ),
    };
  }

  // ─── Adjustments ────────────────────────────────────────────────

  @Get("adjustments")
  async getAdjustments(@Req() request: RequestWithTenant) {
    const { tenant_id: tenant_id } = request.tenantContext;
    const data = await this.inventoryService.getAdjustments(request.tenantContext);
    return { success: true, tenant_id, count: data.length, data };
  }

  @Post("adjustments")
  async createAdjustment(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateAdjustmentDto,
  ) {
    const { tenant_id: tenant_id, user_id, role } = request.tenantContext;
    const data = await this.inventoryService.createAdjustment(
      request.tenantContext,
      dto,
      user_id,
    );
    await this.auditService.log({
      tenant_id: tenant_id,
      user_id: user_id || "system",
      module: "INVENTORY",
      action: "CREATE_ADJUSTMENT",
      entity_type: "ADJUSTMENT",
      entity_id: (data as any).id || "new",
      metadata: { delta: dto.requested_delta, reason: dto.reason },
    });

    // AUTO-APPROVAL for OWNERS & SUPERADMINS
    if (role === UserRole.OWNER || role === UserRole.SUPERADMIN) {
      try {
        await this.inventoryService.approveAdjustment(
          request.tenantContext,
          (data as any).id,
          user_id || "system"
        );
        return { success: true, tenant_id, message: "Adjustment auto-approved by high-privilege identity", data };
      } catch (err) {
        // Fallback to pending if auto-approval fails for some reason
        return { success: true, tenant_id, message: "Adjustment submitted (Auto-approval bypass failed)", data };
      }
    }

    return { success: true, tenant_id, message: "Adjustment request submitted", data };
  }

  @Put("adjustments/:id/approve")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async approveAdjustment(
    @Req() request: RequestWithTenant,
    @Param("id") adjustmentId: string,
    @Body() body: { approvedBy?: string },
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const data = await this.inventoryService.approveAdjustment(
      request.tenantContext,
      adjustmentId,
      body.approvedBy || user_id || "system",
    );
    await this.auditService.log({
      tenant_id: tenant_id,
      user_id: user_id || "system",
      module: "INVENTORY",
      action: "APPROVE_ADJUSTMENT",
      entity_type: "ADJUSTMENT",
      entity_id: adjustmentId,
    });
    return { success: true, tenant_id, message: "Adjustment approved", data };
  }

  // ─── Alerts ─────────────────────────────────────────────────────

  @Get("alerts")
  async getAlerts(@Req() request: RequestWithTenant) {
    const { tenant_id: tenant_id } = request.tenantContext;
    const data = await this.inventoryService.getAlerts(request.tenantContext);
    return { success: true, tenant_id, count: data.length, data };
  }

  @Put("alerts/:id/status")
  async setAlertStatus(
    @Req() request: RequestWithTenant,
    @Param("id") alertId: string,
    @Body() body: { status: "open" | "acknowledged" | "resolved" },
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const data = await this.inventoryService.setAlertStatus(
      request.tenantContext,
      alertId,
      body.status,
    );
    await this.auditService.log({
      tenant_id: tenant_id,
      user_id: user_id || "system",
      module: "INVENTORY",
      action: "SET_ALERT_STATUS",
      entity_type: "ALERT",
      entity_id: alertId,
      metadata: { status: body.status },
    });
    return { success: true, tenant_id, data };
  }

  // ─── Audit Cycles ────────────────────────────────────────────────

  @Get("audit-cycles")
  async getAuditCycles(@Req() request: RequestWithTenant) {
    const { tenant_id: tenant_id } = request.tenantContext;
    const data = await this.inventoryService.getAuditCycles(request.tenantContext);
    return { success: true, tenant_id, count: data.length, data };
  }

  @Post("audit-cycles")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async createAuditCycle(
    @Req() request: RequestWithTenant,
    @Body() body: { location_id: string; department_id?: string; scope: string },
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const data = await this.inventoryService.createAuditCycle(request.tenantContext, {
      ...body,
      createdBy: user_id || "system",
    });
    await this.auditService.log({
      tenant_id: tenant_id,
      user_id: user_id || "system",
      module: "INVENTORY",
      action: "START_AUDIT_CYCLE",
      entity_type: "AUDIT_CYCLE",
      entity_id: (data as any).id || "new",
      metadata: { location_id: body.location_id, scope: body.scope },
    });
    return {
      success: true,
      tenant_id,
      message: "Audit cycle started",
      data,
    };
  }

  @Post("audit/initiate")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async initiateAudit(
    @Req() request: RequestWithTenant,
    @Body() body: { location_id: string; department_id?: string; scope: string },
  ) {
    return this.createAuditCycle(request, body);
  }

  @Post("audit/:id/items")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async createAuditItem(
    @Req() request: RequestWithTenant,
    @Param("id") cycleId: string,
    @Body() body: any,
  ) {
    const { role } = request.tenantContext;
    
    // Auto-approve if OWNER or SUPERADMIN
    const status = (role === "OWNER" || role === "SUPERADMIN") ? "active" : "pending_audit_approval";
    
    return this.inventoryService.createAuditPendingItem(
      request.tenantContext, 
      { ...body, status }, 
      cycleId
    );
  }

  @Put("audit-cycles/:id")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async updateAuditCycle(
    @Req() request: RequestWithTenant,
    @Param("id") cycleId: string,
    @Body() body: { 
      counted_value?: number; 
      variance_value?: number; 
      status?: string; 
      closed_by?: string;
      items?: any[];
      newItems?: any[];
    },
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const data = await this.inventoryService.updateAuditCycle(request.tenantContext, cycleId, {
      ...body,
      closed_by: body.closed_by || user_id || "system",
    });
    await this.auditService.log({
      tenant_id: tenant_id,
      user_id: user_id || "system",
      module: "INVENTORY",
      action: "CLOSE_AUDIT_CYCLE",
      entity_type: "AUDIT_CYCLE",
      entity_id: cycleId,
      metadata: { status: body.status, variance: body.variance_value },
    });
    return { success: true, tenant_id, message: "Audit cycle updated", data };
  }

  // ─── Integration Events ─────────────────────────────────────────

  @Get("integration-events")
  async getIntegrationEvents(@Req() request: RequestWithTenant) {
    const { tenant_id: tenant_id } = request.tenantContext;
    const data = await this.inventoryService.getIntegrationEvents(request.tenantContext);
    return { success: true, tenant_id, count: data.length, data };
  }

  // ─── Stock Scans ─────────────────────────────────────────────────

  @Post("scans/low-stock")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async runLowStockScan(@Req() request: RequestWithTenant) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const result = await this.inventoryService.runLowStockScan(request.tenantContext);
    await this.auditService.log({
      tenant_id: tenant_id,
      user_id: user_id || "system",
      module: "INVENTORY",
      action: "LOW_STOCK_SCAN",
      entity_type: "SCAN",
      entity_id: "system",
      metadata: result,
    });
    return { success: true, tenant_id, data: result };
  }

  @Post("scans/expiry")
  @RequireInventoryRole(InventoryRole.SUPERVISOR)
  async runExpiryScan(@Req() request: RequestWithTenant) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const result = await this.inventoryService.runExpiryScan(request.tenantContext);
    await this.auditService.log({
      tenant_id: tenant_id,
      user_id: user_id || "system",
      module: "INVENTORY",
      action: "EXPIRY_SCAN",
      entity_type: "SCAN",
      entity_id: "system",
      metadata: result,
    });
    return { success: true, tenant_id, data: result };
  }

  // ─── Batch Intake ────────────────────────────────────────────────

  @Post("batch-intake")
  async batchIntake(
    @Req() request: RequestWithTenant,
    @Body() body: { items: StockIntakeDto[] },
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const data = await this.inventoryService.batchIntakeStock(
      request.tenantContext,
      body.items || [],
      user_id,
    );
    return {
      success: true,
      tenant_id,
      message: `${data.length} items processed`,
      data,
    };
  }

  // ─── Procurement Request ────────────────────────────────────────

  @Post("procurement-request")
  async createProcurementRequest(
    @Req() request: RequestWithTenant,
    @Body() body: any,
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const data = await this.inventoryService.requestProcurement(request.tenantContext, {
      ...body,
      requesterId: user_id || body.requesterId,
    });
    await this.auditService.log({
      tenant_id: tenant_id,
      user_id: user_id || "system",
      module: "INVENTORY",
      action: "PROCUREMENT_REQUEST",
      entity_type: "REQUISITION",
      entity_id: (data as any)?.id || "new",
      metadata: { title: body.title, amount: body.amount },
    });
    return {
      success: true,
      tenant_id,
      message: "Procurement request submitted",
      data,
    };
  }
  // --- Agentic Layer ---

  @Get("agentic/events")
  async getAgenticEvents(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const data = await this.inventoryService.getAgenticEvents(request.tenantContext);
    return { success: true, tenant_id, count: data.length, data };
  }

  @Post("agentic/events")
  async createAgenticEvent(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateAgenticEventDto,
  ) {
    const { tenant_id } = request.tenantContext;
    const data = await this.inventoryService.createAgenticEvent(request.tenantContext, dto);
    return { success: true, tenant_id, data };
  }

  // --- IoT & Edge Layer ---

  @Get("iot/events")
  async getIotEvents(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const data = await this.inventoryService.listIotEvents(request.tenantContext);
    return { success: true, tenant_id, count: data.length, data };
  }

  // --- Procurement Receipt Integration ---

  @Get("procurement-receipts")
  async getProcurementReceipts(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const data = await this.inventoryService.listProcurementReceipts(request.tenantContext);
    return { success: true, tenant_id, count: data.length, data };
  }

  @Post("procurement-receipts/:id/process")
  async processProcurementReceipt(
    @Req() request: RequestWithTenant,
    @Param("id") finalPoId: string,
    @Body() body: {
      location_id: string;
      items: Array<{ sku: string; quantity: number; unit_cost?: number }>;
    },
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const data = await this.inventoryService.processProcurementReceipt(
      request.tenantContext,
      finalPoId,
      body,
      user_id,
    );
    return { success: true, tenant_id, message: "Receipt processed and inventory intake triggered", data };
  }

  // --- Category Management ---
  @Get("categories")
  async getCategories(@Req() request: RequestWithTenant) {
    return this.inventoryService.getCategories(request.tenantContext);
  }

  @Post("categories")
  async createCategory(@Req() request: RequestWithTenant, @Body() data: CreateCategoryDto) {
    return this.inventoryService.createCategory(request.tenantContext, data);
  }

  @Put("categories/:id")
  async updateCategory(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() data: CreateCategoryDto,
  ) {
    return this.inventoryService.updateCategory(request.tenantContext, id, data);
  }

  @Delete("categories/:id")
  async deleteCategory(@Req() request: RequestWithTenant, @Param("id") id: string) {
    return this.inventoryService.deleteCategory(request.tenantContext, id);
  }

  @Patch("items/:id/category")
  async updateItemCategory(
    @Req() request: RequestWithTenant,
    @Param("id") itemId: string,
    @Body("categoryId") categoryId: string,
  ) {
    return this.inventoryService.updateItemCategory(request.tenantContext, itemId, categoryId);
  }

  @Patch("items/:id")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async updateItem(
    @Req() request: RequestWithTenant,
    @Param("id") itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const data = await this.inventoryService.updateItem(request.tenantContext, itemId, dto, user_id);
    await this.cacheHelper.invalidateAll();
    return { success: true, tenant_id, data };
  }

  @Patch("items/:id/complete")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async completeAnomalyItem(
    @Req() request: RequestWithTenant,
    @Param("id") itemId: string,
    @Body() dto: { name?: string; category_id?: string; base_price?: number; is_anomaly?: boolean },
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    
    // If category is being changed and was Anomaly, clear is_anomaly flag
    if (dto.category_id) {
      const currentItem = await this.inventoryService.getItemById(request.tenantContext, itemId);
      const category = await this.inventoryService.getCategoryById(request.tenantContext, currentItem?.category_id);
      
      // If current category is Anomaly and we're changing it, clear is_anomaly flag
      if (currentItem?.is_anomaly && category?.name === "Anomaly" && dto.category_id !== currentItem.category_id) {
        dto.is_anomaly = false;
      }
    }
    
    const data = await this.inventoryService.updateItem(request.tenantContext, itemId, dto, user_id);
    return { success: true, tenant_id, data };
  }

  @Post("items/anomaly-category")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async getOrCreateAnomalyCategory(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const category = await this.inventoryService.getOrCreateAnomalyCategory(request.tenantContext);
    return { success: true, tenant_id, data: category };
  }

  @Post("items/batch-incomplete")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async batchCreateIncompleteItems(
    @Req() request: RequestWithTenant,
    @Body() body: { items: { barcode: string; name: string }[] }
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const result = await this.inventoryService.batchCreateIncompleteItems(
      request.tenantContext,
      body.items,
      user_id
    );
    return {
      success: result.success,
      tenant_id,
      message: `${result.created.length} incomplete items created`,
      data: result.created,
      ...(result.failed.length > 0 && {
        failed: result.failed,
        partial: true,
      }),
    };
  }

  @Get("items/:id/sales-history")
  @RequireInventoryRole(InventoryRole.CLERK)
  async getSalesHistory(
    @Req() request: RequestWithTenant,
    @Param("id") itemId: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const data = await this.inventoryService.getSalesHistory(request.tenantContext, itemId);
    return { success: true, tenant_id, data };
  }

  @Get("items/:id/procurement-history")
  @RequireInventoryRole(InventoryRole.CLERK)
  async getProcurementHistory(
    @Req() request: RequestWithTenant,
    @Param("id") itemId: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const data = await this.inventoryService.getProcurementHistory(request.tenantContext, itemId);
    return { success: true, tenant_id, data };
  }

  @Post("items/mark-anomalies")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async markItemsAsAnomalies(
    @Req() request: RequestWithTenant,
    @Body() body: { item_ids: string[]; reason: string },
  ) {
    const { tenant_id: tenant_id, user_id } = request.tenantContext;
    const count = await this.inventoryService.markItemsAsAnomalies(
      request.tenantContext,
      body.item_ids,
      body.reason,
      user_id
    );
    return { success: true, tenant_id, count };
  }

  @Post("items/void-request")
  async createVoidRequest(
    @Req() request: RequestWithTenant,
    @Body() body: {
      item_id: string;
      reason: string;
      requested_by: string;
    }
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    
    // For incomplete items, entity_type is "incomplete_item"
    const voidRequest = await this.inventoryService.createVoidRequest(
      request.tenantContext,
      "incomplete_item",
      body.item_id,
      body.reason,
      body.requested_by || user_id
    );
    
    return {
      success: true,
      tenant_id,
      approval_request_id: voidRequest.id,
      status: voidRequest.status,
    };
  }

  @Get("void-requests")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async listVoidRequests(
    @Req() request: RequestWithTenant,
    @Query("status") status?: string,
    @Query("entity_type") entity_type?: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const filters: { status?: string; entity_type?: string } = {};
    if (status) filters.status = status;
    if (entity_type) filters.entity_type = entity_type;

    const voidRequests = await this.inventoryService.listVoidRequests(
      request.tenantContext,
      filters
    );
    return { success: true, tenant_id, data: voidRequests };
  }

  @Get("void-requests/:id")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async getVoidRequest(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const voidRequest = await this.inventoryService.getVoidRequestById(
      request.tenantContext,
      id
    );
    if (!voidRequest) {
      throw new NotFoundException("Void request not found");
    }
    return { success: true, tenant_id, data: voidRequest };
  }

  @Post("void-requests/:id/approve")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async approveVoidRequest(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const approvedRequest = await this.inventoryService.approveVoidRequest(
      request.tenantContext,
      id,
      user_id
    );
    return {
      success: true,
      tenant_id,
      data: approvedRequest,
    };
  }

  @Post("void-requests/:id/reject")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async rejectVoidRequest(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() body: { reason?: string },
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const rejectedRequest = await this.inventoryService.rejectVoidRequest(
      request.tenantContext,
      id,
      user_id,
      body.reason
    );
    return {
      success: true,
      tenant_id,
      data: rejectedRequest,
    };
  }

  // ─── Abandoned Audit Cycle Resolution ────────────────────────────────

  @Get("audit-cycles/abandoned")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async getAbandonedAuditCycles(
    @Req() request: RequestWithTenant,
    @Query("threshold_hours") thresholdHours?: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const threshold = thresholdHours ? parseInt(thresholdHours, 10) : 24;
    const abandonedCycles = await this.inventoryService.getAbandonedAuditCycles(
      request.tenantContext,
      threshold,
    );
    return { success: true, tenant_id, count: abandonedCycles.length, data: abandonedCycles };
  }

  @Post("audit-cycles/:id/flag-abandoned")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async flagAbandonedCycle(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const flaggedCycle = await this.inventoryService.flagAbandonedCycle(
      request.tenantContext,
      id,
      user_id,
    );
    return { success: true, tenant_id, message: "Audit cycle flagged as abandoned", data: flaggedCycle };
  }

  @Post("audit-cycles/:id/void")
  @RequireInventoryRole(InventoryRole.MANAGER)
  async voidAbandonedCycle(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() body: { reason: string },
  ) {
    const { tenant_id, user_id } = request.tenantContext;

    if (!body.reason || body.reason.trim().length === 0) {
      throw new BadRequestException("A reason is required to void an abandoned audit cycle");
    }

    const voidRequest = await this.inventoryService.voidAbandonedCycle(
      request.tenantContext,
      id,
      body.reason,
      user_id,
    );

    return {
      success: true,
      tenant_id,
      approval_request_id: voidRequest.id,
      status: voidRequest.status,
    };
  }
}

