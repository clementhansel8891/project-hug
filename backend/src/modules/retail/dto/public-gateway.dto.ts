import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsNumber,
} from "class-validator";
import { Type } from "class-transformer";

// --- Product Enrichment DTOs ---

export class MultiCurrencyPriceDto {
  @IsNumber()
  amount: number;

  @IsString()
  currency: string;
}

export class ProductVariantDto {
  @IsString()
  id: string;

  @IsString()
  sku_suffix: string;

  @IsString()
  name: string;

  @IsNumber()
  price_adjustment: number;

  @IsOptional()
  attributes?: Record<string, string>;
}

export class SEOMetadataDto {
  @IsString()
  title: string;

  @IsString()
  metaDescription: string;

  @IsArray()
  @IsString({ each: true })
  keywords: string[];
}

export class ProductDeepDiveDto {
  id: string;
  sku: string;
  name: string;
  description: string;
  base_price: number;
  currency: string;
  prices: MultiCurrencyPriceDto[];
  variants: ProductVariantDto[];
  seo?: SEOMetadataDto;
  stockLevel: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
}

// --- Category DTOs ---

export class CategoryTreeDto {
  id: string;
  name: string;
  slug: string;
  @IsOptional()
  parent_id?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryTreeDto)
  children?: CategoryTreeDto[];
}

// --- Promotions DTOs ---

export class PromotionDto {
  id: string;
  code: string;
  label: string;
  discountType: "PERCENT" | "FIXED";
  value: number;
  scope: "GLOBAL" | "CATEGORY";
}

// --- Existing DTO Updates ---

export class PublicCustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class PublicOrderItemDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsOptional()
  @IsString()
  variantId?: string;
}

export class RetailPublicOrderRequestDto {
  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PublicCustomerDto)
  customer?: PublicCustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicOrderItemDto)
  items: PublicOrderItemDto[];

  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsEnum(["PAID", "PENDING"])
  payment_status: "PAID" | "PENDING";
}

export class PublicOrderResponseDto {
  order_id: string;
  status: "RECEIVED" | "RESERVED" | "PROCESSING" | "REJECTED";
  reservationTimeout?: string;
  totals: {
    subtotal: number;
    tax: number;
    grand_total: number;
  };
  estimatedDelivery?: string;
  message: string;
}

// --- Customer Auth DTOs ---

export class CustomerRegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class CustomerLoginDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class CustomerRefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

// --- Cart DTOs ---

export class CartItemDto {
  @IsString()
  @IsNotEmpty()
  product_id: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}

export class UpdateCartItemDto {
  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}

// --- Wishlist DTOs ---

export class WishlistItemDto {
  @IsOptional()
  @IsString()
  product_id?: string;

  @IsOptional()
  @IsString()
  sku?: string;
}
