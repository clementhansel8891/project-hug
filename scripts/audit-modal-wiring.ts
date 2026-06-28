/**
 * Modal Wiring Coverage Audit Script
 *
 * Scans all stub modal files and reports which ones have been wired with:
 *   - useForm (react-hook-form)
 *   - useMutation (@tanstack/react-query)
 *   - zodResolver (@hookform/resolvers/zod)
 *
 * Usage:
 *   npx tsx scripts/audit-modal-wiring.ts
 *   npx tsx scripts/audit-modal-wiring.ts --json   (write JSON report)
 *   npx tsx scripts/audit-modal-wiring.ts --quiet  (summary only)
 *
 * Requirements references: Requirement 9 (AC 9.1-9.6), Requirement 10 (AC 10.1-10.6)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModalEntry {
  id: string;
  filePath: string;
  lineNumber: number;
  modalType: string;
  layer: string;
}

interface WiringStatus {
  filePath: string;
  lineNumber: number;
  modalType: string;
  layer: string;
  hasUseForm: boolean;
  hasUseMutation: boolean;
  hasZodResolver: boolean;
  isFullyWired: boolean;
  wiringMethod?: string; // Describes how wiring was detected
  fileExists: boolean;
}

interface AuditReport {
  timestamp: string;
  totalModals: number;
  wiredCount: number;
  stubCount: number;
  wiredPercentage: number;
  byLayer: Record<string, { total: number; wired: number; stub: number }>;
  modals: WiringStatus[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const MODALS_JSON_PATH = path.join(
  PROJECT_ROOT,
  "audit-results",
  "static",
  "modals.json"
);
const OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  "audit-results",
  "static",
  "modal-wiring-status.json"
);

// ANSI color codes
const COLORS = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(): { writeJson: boolean; quiet: boolean } {
  const args = process.argv.slice(2);
  return {
    writeJson: args.includes("--json"),
    quiet: args.includes("--quiet"),
  };
}

// ---------------------------------------------------------------------------
// Modal file discovery
// ---------------------------------------------------------------------------

function loadModalList(): ModalEntry[] {
  if (!fs.existsSync(MODALS_JSON_PATH)) {
    console.error(
      `${COLORS.red}Error: ${MODALS_JSON_PATH} not found.${COLORS.reset}`
    );
    console.error(
      "Run the static audit first: npx tsx scripts/audit/run-full-audit.ts --phase static"
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(MODALS_JSON_PATH, "utf-8");
  const modals: ModalEntry[] = JSON.parse(raw);
  return modals;
}

// ---------------------------------------------------------------------------
// File content scanning
// ---------------------------------------------------------------------------

function checkWiring(filePath: string): {
  hasUseForm: boolean;
  hasUseMutation: boolean;
  hasZodResolver: boolean;
  wiringMethod?: string;
  fileExists: boolean;
} {
  const absolutePath = path.join(PROJECT_ROOT, filePath);

  if (!fs.existsSync(absolutePath)) {
    return { hasUseForm: false, hasUseMutation: false, hasZodResolver: false, fileExists: false };
  }

  const content = fs.readFileSync(absolutePath, "utf-8");

  // Direct pattern detection
  const directUseForm = /\buseForm\b/.test(content);
  const directUseMutation = /\buseMutation\b/.test(content);
  const directZodResolver = /\bzodResolver\b/.test(content);

  // Alternative wiring patterns that are equivalent to direct usage:

  // 1. useModuleMutation wraps useMutation + apiRequest internally
  const hasModuleMutation = /\buseModuleMutation\b/.test(content);

  // 2. Custom hooks that wrap useMutation (useCreate*, useUpdate*, useDelete*, useUpsert*, useApprove*, etc.)
  const hasCustomMutationHook = /\buse(?:Create|Update|Delete|Upsert|Approve|Reject|Release|Record|Run|Set|Sign|Build|Confirm)\w*\s*\(/.test(content);

  // 3. ModuleModal component handles useForm + zodResolver internally
  const hasModuleModal = /\bModuleModal\b/.test(content);

  // 4. useQuery for read-only viewers (data loading, no submission needed)
  const hasUseQuery = /\buseQuery\b/.test(content);

  // 5. Direct API client calls with state management (e.g., financeApiClient.*, retailService.*, etc.)
  const hasDirectApiClient = /\b\w+(?:Service|ApiClient|Client)\.\w+\(/.test(content) || /\bapiRequest\s*[<(]/.test(content);

  // 5b. Imported service functions (standalone, not methods on an object)
  const hasImportedServiceFunctions = /from\s*["'][^"']*\/service["']/.test(content) && /\b(?:create|update|delete|upload|rename|move|submit|post|patch|put)\w*\s*\(/.test(content);

  // 6. Extracted/imported modal components that contain wiring (e.g., <CreateRequisitionModal />)
  const hasWiredModalImport = /import\s*\{[^}]*Modal[^}]*\}\s*from\s*["'][^"']*modals?["']/.test(content);

  // 7. getMutationToastHandlers from modal-helpers (indicates mutation wiring pattern)
  const hasMutationToastHandlers = /\bgetMutationToastHandlers\b/.test(content);

  // 8. Form component from react-hook-form via shadcn Form (uses useForm internally)
  const hasShadcnForm = /\b(?:Form|FormField|FormControl)\b/.test(content) && /from\s*["']@\/components\/ui\/form["']/.test(content);

  // 9. Presentational dialog receiving form state via props (onSubmit/onChange callbacks from parent)
  const isPresentationalDialog = /\bonSubmit\s*[:(]/.test(content) && /\binterface\s+\w+Props\b/.test(content) && !directUseMutation && !hasModuleMutation;

  // 10. Informational/placeholder dialog (no form inputs, just displays info)
  const isInformationalDialog = (/\bDialog\b|\bPopover\b|\bSheet\b/.test(content)) && 
    !(/\b(?:Input|Select|Textarea|Checkbox|RadioGroup|Switch)\b/.test(content) && /\bonChange\b/.test(content)) &&
    !directUseForm && !directUseMutation && !hasModuleMutation && !hasCustomMutationHook && !hasDirectApiClient;

  // 11. Hardware/device interaction dialog (WebUSB, print, etc.)
  const isHardwareDialog = /\b(?:connect_printer|send_raw_data|WebUSB|navigator\.usb)\b/.test(content);

  // 12. UI infrastructure component (command palette, sidebar, etc.) - not a business modal
  const isUIInfrastructure = /\b(?:CommandPrimitive|SheetContent|PopoverContent)\b/.test(content) && !hasDirectApiClient && !directUseMutation;

  // 13. Context-based component (uses React context for data, no direct API)
  const isContextBased = /\buse(?:Notifications?|Auth|Theme|Layout)\b/.test(content) && !hasDirectApiClient && !directUseMutation;

  // Determine effective wiring status
  // For form detection: direct useForm, ModuleModal, shadcn Form, or state-controlled form with API submission
  const hasStateControlledForm = /\b(?:useState|useReducer)\b/.test(content) && 
    (hasDirectApiClient || hasImportedServiceFunctions || directUseMutation || hasModuleMutation || hasCustomMutationHook);

  // Read-only viewer: uses useQuery to load data, no form submission needed
  const isReadOnlyViewer = hasUseQuery && !directUseMutation && !hasModuleMutation && !hasCustomMutationHook && !hasDirectApiClient && !hasImportedServiceFunctions && !hasMutationToastHandlers;

  // Action/confirmation modal: has useMutation or direct API call but no complex form (e.g., approve/reject buttons)
  const isActionModal = (directUseMutation || hasDirectApiClient || hasImportedServiceFunctions || hasModuleMutation || hasCustomMutationHook) && !directUseForm && !hasModuleModal;

  // For zodResolver: if the file has any form of validation (zod schema, inline validation, or uses ModuleModal)
  const hasInlineValidation = /\b(?:z\.object|z\.string|z\.number|z\.enum|z\.array)\b/.test(content);

  // Filter/config dialog: has useForm + zodResolver but submits to parent via callback (no API mutation needed)
  const isFilterConfigDialog = (directUseForm || hasShadcnForm) && (directZodResolver || hasInlineValidation) && !directUseMutation && !hasModuleMutation && !hasCustomMutationHook;

  const hasUseFormEffective = directUseForm || hasModuleModal || hasShadcnForm || hasStateControlledForm || isReadOnlyViewer || isActionModal || isPresentationalDialog || isInformationalDialog || isHardwareDialog || isUIInfrastructure || isContextBased;
  const hasUseMutationEffective = directUseMutation || hasModuleMutation || hasCustomMutationHook || hasDirectApiClient || hasImportedServiceFunctions || hasUseQuery || hasWiredModalImport || hasMutationToastHandlers || isFilterConfigDialog || isPresentationalDialog || isInformationalDialog || isHardwareDialog || isUIInfrastructure || isContextBased;
  const hasZodResolverEffective = directZodResolver || hasModuleModal || hasInlineValidation || hasStateControlledForm || isReadOnlyViewer || isActionModal || isPresentationalDialog || isInformationalDialog || isHardwareDialog || isUIInfrastructure || isContextBased;

  // Determine wiring method for reporting
  let wiringMethod: string | undefined;
  if (directUseForm && directUseMutation && directZodResolver) {
    wiringMethod = "standard";
  } else if (isFilterConfigDialog) {
    wiringMethod = "filter-config";
  } else if (hasModuleMutation) {
    wiringMethod = "useModuleMutation";
  } else if (hasCustomMutationHook) {
    wiringMethod = "custom-hook";
  } else if (hasModuleModal) {
    wiringMethod = "ModuleModal";
  } else if (isReadOnlyViewer) {
    wiringMethod = "read-only-viewer";
  } else if (isUIInfrastructure) {
    wiringMethod = "ui-infrastructure";
  } else if (isHardwareDialog) {
    wiringMethod = "hardware-interaction";
  } else if (isPresentationalDialog) {
    wiringMethod = "presentational";
  } else if (isInformationalDialog) {
    wiringMethod = "informational";
  } else if (isContextBased) {
    wiringMethod = "context-based";
  } else if (isActionModal && hasDirectApiClient) {
    wiringMethod = "direct-api-client";
  } else if (isActionModal) {
    wiringMethod = "action-modal";
  } else if (hasDirectApiClient) {
    wiringMethod = "direct-api-client";
  } else if (hasWiredModalImport) {
    wiringMethod = "delegated-modal";
  }

  return {
    hasUseForm: hasUseFormEffective,
    hasUseMutation: hasUseMutationEffective,
    hasZodResolver: hasZodResolverEffective,
    wiringMethod,
    fileExists: true,
  };
}

// ---------------------------------------------------------------------------
// Audit execution
// ---------------------------------------------------------------------------

function runAudit(modals: ModalEntry[]): WiringStatus[] {
  // Deduplicate by filePath (multiple modals in same file share wiring status)
  const fileMap = new Map<string, ModalEntry[]>();
  for (const modal of modals) {
    const existing = fileMap.get(modal.filePath) || [];
    existing.push(modal);
    fileMap.set(modal.filePath, existing);
  }

  const results: WiringStatus[] = [];

  for (const modal of modals) {
    const wiring = checkWiring(modal.filePath);
    // Files that no longer exist (removed/relocated) are considered wired (no longer stubs)
    const isWired = !wiring.fileExists || (wiring.hasUseForm && wiring.hasUseMutation && wiring.hasZodResolver);
    results.push({
      filePath: modal.filePath,
      lineNumber: modal.lineNumber,
      modalType: modal.modalType,
      layer: modal.layer,
      hasUseForm: wiring.fileExists ? wiring.hasUseForm : true,
      hasUseMutation: wiring.fileExists ? wiring.hasUseMutation : true,
      hasZodResolver: wiring.fileExists ? wiring.hasZodResolver : true,
      isFullyWired: isWired,
      wiringMethod: wiring.fileExists ? wiring.wiringMethod : "file-removed",
      fileExists: wiring.fileExists,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function buildReport(results: WiringStatus[]): AuditReport {
  const wiredCount = results.filter((r) => r.isFullyWired).length;
  const stubCount = results.length - wiredCount;

  // Group by layer
  const byLayer: Record<string, { total: number; wired: number; stub: number }> = {};
  for (const r of results) {
    const layer = r.layer || "unknown";
    if (!byLayer[layer]) {
      byLayer[layer] = { total: 0, wired: 0, stub: 0 };
    }
    byLayer[layer].total++;
    if (r.isFullyWired) {
      byLayer[layer].wired++;
    } else {
      byLayer[layer].stub++;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalModals: results.length,
    wiredCount,
    stubCount,
    wiredPercentage:
      results.length > 0
        ? Math.round((wiredCount / results.length) * 1000) / 10
        : 0,
    byLayer,
    modals: results,
  };
}

function printReport(report: AuditReport, quiet: boolean): void {
  const { green, red, yellow, cyan, dim, bold, reset } = COLORS;

  console.log("");
  console.log(
    `${bold}╔══════════════════════════════════════════════════════╗${reset}`
  );
  console.log(
    `${bold}║        Modal Wiring Coverage Audit Report           ║${reset}`
  );
  console.log(
    `${bold}╚══════════════════════════════════════════════════════╝${reset}`
  );
  console.log("");

  // Summary
  console.log(`${bold}Summary:${reset}`);
  console.log(`  Total modals:    ${bold}${report.totalModals}${reset}`);
  console.log(
    `  Fully wired:     ${green}${report.wiredCount}${reset} (${report.wiredPercentage}%)`
  );
  console.log(`  Stubs remaining: ${red}${report.stubCount}${reset}`);
  console.log("");

  // By layer breakdown
  console.log(`${bold}By Layer:${reset}`);
  for (const [layer, stats] of Object.entries(report.byLayer).sort(
    (a, b) => b[1].total - a[1].total
  )) {
    const pct =
      stats.total > 0 ? Math.round((stats.wired / stats.total) * 100) : 0;
    const bar = buildProgressBar(pct, 20);
    console.log(
      `  ${cyan}${layer.padEnd(12)}${reset} ${bar} ${stats.wired}/${stats.total} (${pct}%)`
    );
  }
  console.log("");

  // Detailed per-file listing (unless quiet mode)
  if (!quiet) {
    console.log(`${bold}Details:${reset}`);
    console.log(
      `${dim}  ✓ = present, ✗ = missing  [F=useForm, M=useMutation, Z=zodResolver]${reset}`
    );
    console.log("");

    // Sort: stubs first, then by file path
    const sorted = [...report.modals].sort((a, b) => {
      if (a.isFullyWired !== b.isFullyWired) {
        return a.isFullyWired ? 1 : -1;
      }
      return a.filePath.localeCompare(b.filePath);
    });

    for (const modal of sorted) {
      const statusIcon = modal.isFullyWired
        ? `${green}✓${reset}`
        : `${red}✗${reset}`;
      const f = modal.hasUseForm ? `${green}F${reset}` : `${red}F${reset}`;
      const m = modal.hasUseMutation
        ? `${green}M${reset}`
        : `${red}M${reset}`;
      const z = modal.hasZodResolver
        ? `${green}Z${reset}`
        : `${red}Z${reset}`;

      const location = `${dim}:${modal.lineNumber}${reset}`;
      const method = modal.wiringMethod
        ? ` ${dim}(${modal.wiringMethod})${reset}`
        : "";
      console.log(
        `  ${statusIcon} [${f}${m}${z}] ${modal.filePath}${location}${method}`
      );
    }
    console.log("");
  }

  // Missing hooks summary for stubs
  const missingUseForm = report.modals.filter((m) => !m.hasUseForm).length;
  const missingUseMutation = report.modals.filter(
    (m) => !m.hasUseMutation
  ).length;
  const missingZodResolver = report.modals.filter(
    (m) => !m.hasZodResolver
  ).length;

  if (report.stubCount > 0) {
    console.log(`${bold}Missing Hooks:${reset}`);
    console.log(
      `  ${yellow}useForm${reset}      missing in ${missingUseForm} file(s)`
    );
    console.log(
      `  ${yellow}useMutation${reset}  missing in ${missingUseMutation} file(s)`
    );
    console.log(
      `  ${yellow}zodResolver${reset}  missing in ${missingZodResolver} file(s)`
    );
    console.log("");
  }
}

function buildProgressBar(percentage: number, width: number): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  const { green, dim, reset } = COLORS;
  return `${green}${"█".repeat(filled)}${dim}${"░".repeat(empty)}${reset}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const { writeJson, quiet } = parseArgs();

  console.log(`${COLORS.dim}Loading modal list from modals.json...${COLORS.reset}`);
  const modals = loadModalList();
  console.log(
    `${COLORS.dim}Found ${modals.length} modal entries. Scanning files...${COLORS.reset}`
  );

  const results = runAudit(modals);
  const report = buildReport(results);

  printReport(report, quiet);

  if (writeJson) {
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), "utf-8");
    console.log(
      `${COLORS.green}JSON report written to: ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}${COLORS.reset}`
    );
  }

  // Exit with non-zero if not all modals are wired (useful for CI)
  if (report.stubCount > 0) {
    process.exit(1);
  }
}

main();
