import { IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean, Min } from 'class-validator';

/**
 * DTO for creating a warehouse bin.
 * Only schema-valid fields are accepted — anything else is stripped
 * by the global validation pipe (whitelist: true).
 */
export class CreateBinDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  zone?: string;

  @IsString()
  @IsOptional()
  aisle?: string;

  @IsString()
  @IsOptional()
  rack?: string;

  @IsString()
  @IsOptional()
  level?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  capacity?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
