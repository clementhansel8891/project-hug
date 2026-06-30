import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Res,
  Patch,
  BadRequestException,
} from "@nestjs/common";
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { ExplorerService } from "./explorer.service";
import { CreateFolderDto } from "./dto/create-folder.dto";
import { CreateFileDto } from "./dto/create-file.dto";
import { CreateNoteDto } from "./dto/create-note.dto";
import { TenantInterceptor } from "../../gateway/tenant.interceptor";
import { TenantGuard } from "../../shared/guards/tenant.guard";
import { RequestWithTenant } from "../../gateway/tenant-context.interface";

@Controller("explorer")
@UseInterceptors(TenantInterceptor)
@UseGuards(TenantGuard)
export class ExplorerController {
  constructor(private readonly explorerService: ExplorerService) {}

  @Get("system")
  async getFileSystem(
    @Req() req: RequestWithTenant,
    @Query("folder_id") folder_id?: string,
  ) {
    const { tenantContext } = req;
    return this.explorerService.getFileSystem(tenantContext, folder_id);
  }

  @Get("system/recycle-bin")
  async listRecycleBin(@Req() req: RequestWithTenant) {
    const { tenantContext } = req;
    return this.explorerService.listRecycleBin(tenantContext);
  }

  @Get("folders")
  async listFolders(@Req() req: RequestWithTenant) {
    const { tenantContext } = req;
    return this.explorerService.listFolders(tenantContext);
  }

  @Post("folders")
  async createFolder(
    @Req() req: RequestWithTenant,
    @Body() dto: CreateFolderDto,
  ) {
    const { tenantContext } = req;
    return this.explorerService.createFolder(tenantContext, dto);
  }

  @Patch("folders/:id")
  async renameFolder(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
    @Body("name") name: string,
  ) {
    const { tenantContext } = req;
    return this.explorerService.renameFolder(tenantContext, id, name);
  }

  @Post("files/upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(
    @Req() req: RequestWithTenant,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateFileDto,
  ) {
    const { tenantContext } = req;
    if (!file) {
      throw new BadRequestException("A file is required (multipart field 'file')");
    }
    return this.explorerService.uploadFile(tenantContext, file, dto);
  }

  @Get("files/:id")
  async getFile(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenantContext } = req;
    return this.explorerService.getFile(tenantContext, id);
  }

  @Delete("files/:id")
  async deleteFile(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenantContext } = req;
    return this.explorerService.deleteFile(tenantContext, id);
  }

  @Post("files/:id/restore")
  async restoreFile(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
  ) {
    const { tenantContext } = req;
    return this.explorerService.restoreFile(tenantContext, id);
  }

  @Patch("files/:id/move")
  async moveFile(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
    @Body("folder_id") folder_id: string | null,
  ) {
    const { tenantContext } = req;
    return this.explorerService.moveFile(tenantContext, id, folder_id);
  }

  @Patch("files/:id")
  async updateFile(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
    @Body() data: { name?: string; content?: string },
  ) {
    const { tenantContext } = req;
    return this.explorerService.updateFile(tenantContext, id, data);
  }

  @Post("notes")
  async createNote(
    @Req() req: RequestWithTenant,
    @Body() dto: CreateNoteDto,
  ) {
    const { tenantContext } = req;
    return this.explorerService.createNote(tenantContext, dto);
  }

  @Post("forensic-code")
  async generateForensicCode(
    @Req() req: RequestWithTenant,
    @Body() body: { company_id?: string; branch_id?: string },
  ) {
    const { tenant_id, user_id } = req.tenantContext;
    const ip = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
    
    const code = await this.explorerService.generateForensicCode({
      tenant_id,
      user_id: user_id!,
      ip,
      company_id: body.company_id,
      branch_id: body.branch_id,
    });

    return { success: true, forensic_code: code };
  }

  @Get("files/:id/download")
  async downloadFile(
    @Req() req: RequestWithTenant,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const { tenantContext } = req;
    const { buffer, mimeType, fileName } = await this.explorerService.downloadFile(
      tenantContext,
      id,
    );

    res.set({
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": buffer.length,
    });

    res.end(buffer);
  }
}
