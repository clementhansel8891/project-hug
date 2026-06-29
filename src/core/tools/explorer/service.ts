import { apiRequest } from "@/core/api/apiClient";
import type { SessionContext } from "@/core/security/session";
import type { ToolFileRecord, ToolFileType, ToolFolder } from "./types";

export type EstelaGeaTool = "docs" | "sheets" | "slides" | "none";

export function getToolForFile(file: ToolFileRecord): EstelaGeaTool {
  const type = file.type.toLowerCase();
  if (["doc", "docx", "txt", "md", "zdoc"].includes(type)) return "docs";
  if (["xls", "xlsx", "csv", "zsheet"].includes(type)) return "sheets";
  if (["ppt", "pptx", "zslide"].includes(type)) return "slides";
  return "none";
}

/**
 * Estela Gea DMS Service (Frontend)
 * Migrated from localStorage to Backend DMS
 */

export async function listFileSystem(
  session: SessionContext,
  folderId?: string,
): Promise<{ folders: ToolFolder[]; files: ToolFileRecord[]; currentFolder?: ToolFolder }> {
  const query = folderId ? `?folder_id=${folderId}` : "";
  const result = await apiRequest<{ folders: any[]; files: any[]; currentFolder?: any }>(
    `/explorer/system${query}`,
    "GET",
    session,
  );

  return {
    currentFolder: result.currentFolder ? {
      id: result.currentFolder.id,
      name: result.currentFolder.name,
      tenantId: result.currentFolder.tenant_id,
      parentId: result.currentFolder.parent_id,
    } : undefined,
    folders: (Array.isArray(result.folders) ? result.folders : []).map(f => ({
      id: f.id,
      name: f.name,
      tenantId: f.tenant_id,
      departmentId: f.department_id,
      parentId: f.parent_id,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    })),
    files: (Array.isArray(result.files) ? result.files : []).map(f => ({
      id: f.id,
      name: f.name,
      tenantId: f.tenant_id,
      departmentId: f.department_id,
      ownerId: f.owner_id,
      folderId: f.folder_id,
      type: f.type as ToolFileType,
      size: f.size,
      mimeType: f.mime_type,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    })),
  };
}


export async function listFolders(
  session: SessionContext,
): Promise<ToolFolder[]> {
  const result = await apiRequest<any[]>("/explorer/folders", "GET", session);
  return (Array.isArray(result) ? result : []).map(f => ({
    id: f.id,
    name: f.name,
    tenantId: f.tenant_id,
    departmentId: f.department_id,
    parentId: f.parent_id,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  }));
}

export async function createFolder(
  session: SessionContext,
  name: string,
  parentId?: string,
  departmentId?: string,
): Promise<ToolFolder> {
  const result = await apiRequest<any>("/explorer/folders", "POST", session, {
    name,
    parent_id: parentId,
    department_id: departmentId,
  });

  return {
    id: result.id,
    name: result.name,
    tenantId: result.tenant_id,
    departmentId: result.department_id,
    parentId: result.parent_id,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

export async function uploadFile(
  session: SessionContext,
  file: File,
  folderId?: string,
  departmentId?: string,
  metadata?: any,
): Promise<ToolFileRecord> {
  const formData = new FormData();
  formData.append("file", file);
  if (folderId) formData.append("folder_id", folderId);
  if (departmentId) formData.append("department_id", departmentId);
  if (metadata) formData.append("metadata", JSON.stringify(metadata));

  const result = await apiRequest<any>("/explorer/files/upload", "POST", session, formData);

  return {
    id: result.id,
    name: result.name,
    tenantId: result.tenant_id,
    departmentId: result.department_id,
    ownerId: result.owner_id,
    folderId: result.folder_id,
    type: result.type as ToolFileType,
    size: result.size,
    mimeType: result.mime_type,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

export async function deleteFile(
  session: SessionContext,
  fileId: string,
): Promise<void> {
  await apiRequest(`/explorer/files/${fileId}`, "DELETE", session);
}

export async function generateForensicCode(
  session: SessionContext,
  companyId?: string,
  branchId?: string,
): Promise<string> {
  const result = await apiRequest<{ forensic_code: string }>(
    "/explorer/forensic-code",
    "POST",
    session,
    { company_id: companyId, branch_id: branchId }
  );
  return result.forensic_code;
}

export async function moveFile(
  session: SessionContext,
  fileId: string,
  targetFolderId: string,
): Promise<void> {
  await apiRequest(`/explorer/files/${fileId}/move`, "PATCH", session, {
    folder_id: targetFolderId === "root" ? null : targetFolderId,
  });
}

export async function renameFile(
  session: SessionContext,
  fileId: string,
  name: string,
): Promise<void> {
  await apiRequest(`/explorer/files/${fileId}`, "PATCH", session, { name });
}

export async function renameFolder(
  session: SessionContext,
  folderId: string,
  name: string,
): Promise<void> {
  await apiRequest(`/explorer/folders/${folderId}`, "PATCH", session, { name });
}

export async function getFile(
  session: SessionContext,
  fileId: string,
): Promise<ToolFileRecord & { content?: string }> {
  return apiRequest<any>(`/explorer/files/${fileId}`, "GET", session);
}

export async function updateFileContent(
  session: SessionContext,
  fileId: string,
  content: string,
  name?: string,
): Promise<void> {
  await apiRequest(`/explorer/files/${fileId}`, "PATCH", session, { content, name });
}

export async function listRecycleBin(
  session: SessionContext,
): Promise<{ folders: ToolFolder[]; files: ToolFileRecord[] }> {
  const result = await apiRequest<{ folders: any[]; files: any[] }>(
    `/explorer/system/recycle-bin`,
    "GET",
    session,
  );

  return {
    folders: (Array.isArray(result.folders) ? result.folders : []).map(f => ({
      id: f.id,
      name: f.name,
      tenantId: f.tenant_id,
      departmentId: f.department_id,
      parentId: f.parent_id,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    })),
    files: (Array.isArray(result.files) ? result.files : []).map(f => ({
      id: f.id,
      name: f.name,
      tenantId: f.tenant_id,
      departmentId: f.department_id,
      ownerId: f.owner_id,
      folderId: f.folder_id,
      type: f.type as ToolFileType,
      size: f.size,
      mimeType: f.mime_type,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    })),
  };
}

// Recycle bin logic
export async function moveToRecycle(session: SessionContext, fileId: string) { return deleteFile(session, fileId); }
export async function restoreFromRecycle(session: SessionContext, fileId: string) {
  await apiRequest(`/explorer/files/${fileId}/restore`, "POST", session);
}
