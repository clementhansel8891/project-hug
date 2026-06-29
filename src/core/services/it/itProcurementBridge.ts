import { inventoryService } from "@/core/services/inventory/inventoryService";
import { procurementService } from "@/core/services/procurement/procurementService";
import { financeService } from "@/core/services/finance/financeService";
import { itSettingsService } from "@/core/services/it/itSettingsService";
import { SessionContext } from "@/core/security/session";
import { audit } from "@/core/logging/audit";

export interface ITCatalogItem {
  id: string;
  name: string;
  sku: string;
  category: 'HARDWARE' | 'SOFTWARE' | 'SERVICE';
  description: string;
  estimatedCost: number;
  notes: string;
}

export const ESTELAGEA_HARDWARE: ITCatalogItem[] = [
  {
    id: "h-01",
    name: "Estela Gea Money Drawer (Standard)",
    sku: "ZNX-MD-01",
    category: "HARDWARE",
    description: "Heavy-duty thermal-linked money drawer with logical kick sensors.",
    estimatedCost: 1500000,
    notes: "Requires direct connection to Thermal Printer or IoT Bridge."
  },
  {
    id: "h-02",
    name: "Estela Gea Tab (Enterprise 10\")",
    sku: "ZNX-TAB-10",
    category: "HARDWARE",
    description: "Enterprise-grade 10-inch tablet pre-configured with Estela Gea Mobile Shell.",
    estimatedCost: 4500000,
    notes: "Standard issue for Retail Floor Staff."
  },
  {
    id: "h-03",
    name: "Estela Gea Thermal Printer (POS)",
    sku: "ZNX-TP-80",
    category: "HARDWARE",
    description: "High-speed 80mm thermal receipt printer with USB/Ethernet/BT.",
    estimatedCost: 2200000,
    notes: "Essential for POS Terminal nodes."
  },
  {
    id: "h-04",
    name: "Estela Gea Display Touch Screen (22\")",
    sku: "ZNX-TS-22",
    category: "HARDWARE",
    description: "22-inch industrial grade capacitive touch monitor for Kiosk usage.",
    estimatedCost: 7800000,
    notes: "Used in High-Traffic Self-Service zones."
  },
  {
    id: "h-05",
    name: "Estela Gea Kiosk (Elite Core)",
    sku: "ZNX-K-01",
    category: "HARDWARE",
    description: "Standalone self-service kiosk with integrated scanner and printer.",
    estimatedCost: 25000000,
    notes: "Requires Kiosk Software License (S-01)."
  }
];

export const itProcurementBridge = {
  async processCatalogRequest(
    tenantId: string,
    session: SessionContext,
    catalogItem: ITCatalogItem,
    locationId: string,
    notes: string
  ) {
    audit.log({
      tenantId,
      actorId: session.user_id,
      action: "it.catalog.request_init",
      entityType: "catalog_item",
      entityId: catalogItem.id,
      after: { sku: catalogItem.sku, locationId }
    });

    try {
      // 0. Create Persistent Request Record
      const request = await itSettingsService.createRequest(tenantId, session, {
        tenantId,
        requesterId: session.user_id,
        catalogItemId: catalogItem.id,
        sku: catalogItem.sku,
        name: catalogItem.name,
        locationId: locationId,
        notes: notes,
        status: "PENDING"
      });

      // 1. Check Inventory Balances
      const balances = await inventoryService.listBalances(tenantId, session, locationId);
      const stock = balances.find(b => b.itemId === catalogItem.sku || b.id === catalogItem.sku); // SKU-based match
      
      const isAvailable = stock && (stock.quantity - stock.reservedQuantity) > 0;

      if (isAvailable) {
        // FULFILL FROM STOCK
        await inventoryService.recordDeduction(tenantId, session, {
          itemId: stock.itemId,
          locationCode: locationId,
          quantity: 1,
          reason: `IT Service Catalog Fulfillment: ${catalogItem.name}`,
          referenceType: "IT_REQUEST",
          referenceId: catalogItem.id
        });

        // Create Finance Asset
        await financeService.createAsset(tenantId, session, {
          name: catalogItem.name,
          category: "EQUIPMENT",
          initialValue: catalogItem.estimatedCost,
          acquisitionDate: new Date().toISOString(),
          usefulLifeMonths: 36,
          depreciationMethod: "STRAIGHT_LINE",
          locationId: locationId,
          departmentId: "IT",
          notes: `Auto-generated from IT Catalog fulfillment. Request Notes: ${notes}`
        });

        // Register in Device Matrix
        await itSettingsService.addDevice(tenantId, {
          name: catalogItem.name,
          type: catalogItem.category === 'HARDWARE' ? 'TERMINAL' : 'SERVER',
          status: 'HEALTHY',
          ip: "DHCP-PENDING",
          locationId: locationId,
          parentId: null // Can be mapped later in Topology
        });

        // Update Request Status
        // Note: In a real app we'd have an updateRequest method, adding it to the service soon or using createRequest to 'patch' if supported
        // For now, let's assume the service handles status updates via createRequest with ID
        await itSettingsService.createRequest(tenantId, session, {
          ...request,
          status: "FULFILLED"
        });

        return { status: "FULFILLED", detail: "Allocated from existing stock and registered in Device Matrix." };
      } else {
        // TRIGGER PROCUREMENT
        const requisition = await procurementService.createRequisition(tenantId, session, {
          title: `IT Provisioning: ${catalogItem.name}`,
          description: `Automatic requisition triggered by IT Service Catalog. Stock unavailable at ${locationId}. \nNotes: ${notes}`,
          category: "IT_HARDWARE",
          branchCode: locationId,
          budgetClass: "OPEX",
          amount: catalogItem.estimatedCost,
          contractRequired: false
        });

        // Update Request Status
        await itSettingsService.createRequest(tenantId, session, {
          ...request,
          status: "PROCUREMENT_TRIGGERED",
          requisitionId: requisition.id
        });

        return { status: "PROCUREMENT_TRIGGERED", detail: "Stock unavailable. Purchase Requisition created.", requisitionId: requisition.id };
      }
    } catch (error: any) {
      console.error("IT Procurement Bridge Error:", error);
      throw error;
    }
  }
};
