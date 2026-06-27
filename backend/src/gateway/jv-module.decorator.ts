import { SetMetadata } from "@nestjs/common";
import { JV_MODULE_KEY } from "./jv-permission.guard";

/**
 * Decorator to mark a controller or handler with a JV module identifier.
 * Used by JVPermissionGuard to check granular partner access.
 * 
 * @example
 * @JVModule("expenses")
 * @Controller('finance/jv/expenses')
 * export class JVExpenseController { ... }
 */
export const JVModule = (module: string) => SetMetadata(JV_MODULE_KEY, module);
