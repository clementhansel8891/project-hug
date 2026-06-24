import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export enum AdminModuleKey {
  FINANCE = "finance",
  HR = "hr",
  INVENTORY = "inventory",
  PROCUREMENT = "procurement",
  ADMIN = "admin",
  IT = "it",
  SALES = "sales",
  MARKETING = "marketing",
  RETAIL = "retail",
}

export class ToggleModuleDto {
  @IsEnum(AdminModuleKey)
  moduleKey: AdminModuleKey;

  @IsBoolean()
  enabled: boolean;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  updatedBy?: string;
}
