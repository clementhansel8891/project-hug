import { IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * Payload for POST /sales/orders — the CreateOrderModal "Convert won
 * opportunity into a fulfillment order" action. An order is always derived
 * from a won opportunity, so `opportunityId` is the only required field; the
 * route closes that opportunity as WON and creates the resulting sales order
 * through the same atomic pipeline used by `PUT /opportunities/:id/close`.
 *
 * `paymentTerms` and `notes` are accepted for forward-compatibility and audit
 * metadata but are not persisted as `sales_orders` columns (the table has none).
 */
export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  opportunityId: string;

  @IsString()
  @IsOptional()
  quotationId?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
