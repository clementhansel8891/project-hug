import { IsOptional } from "class-validator";

/**
 * One row of a schedule-assignment import file (xlsx/csv). Header cells are
 * normalized to snake_case by FileProcessingService, so these property names
 * map to the template columns:
 *   "Employee Code"  -> employee_code
 *   "Employee Email" -> employee_email
 *   "Shift Name"     -> shift_name
 *   "Date"           -> date           (YYYY-MM-DD)
 *   "Location Name"  -> location_name  (optional; defaults to employee's location)
 *
 * All fields are intentionally optional/untyped at the DTO layer: per-row
 * business validation (employee/shift/location resolution, date parsing) is
 * done in `SchedulingService.importAssignments` so errors carry a row number
 * and a human-readable reason rather than a generic validation failure.
 */
export class ImportScheduleRowDto {
  @IsOptional()
  employee_code?: any;

  @IsOptional()
  employee_email?: any;

  @IsOptional()
  shift_name?: any;

  @IsOptional()
  date?: any;

  @IsOptional()
  location_name?: any;
}
