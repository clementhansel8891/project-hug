# E2E Live Production Tests

## Overview
These scripts simulate a complete business lifecycle against the live production system.
They create a new tenant, set up departments, hire employees, and run real business operations.

## Test Plan

### Phase 1: Onboarding (setup)
- Register new owner user
- Login and provision a new company/tenant
- Create branches and locations

### Phase 2: Organization Setup
- Create departments (Finance, HR, Sales, Marketing, Retail, Warehouse, Procurement, IT)
- Create employees for each department with appropriate roles
- Create employee contracts

### Phase 3: Department Operations
- **HR**: Clock in/out, leave requests, performance reviews
- **Inventory**: Create items, stock intake, transfers
- **Retail**: Open shift, POS checkout, close shift, reconcile
- **Sales**: Create leads, convert to opportunity, quotes, close deals
- **Marketing**: Create campaigns, capture leads, handoff to sales
- **Procurement**: Create suppliers, requisitions, POs, goods receipt
- **Finance**: Chart of Accounts, posting rules, journals, payroll
- **Payment**: Create transactions, approve, settle

### Phase 4: Cross-Module Flows
- Sales lead → Marketing handoff → Sales opportunity → Retail order
- Procurement PO → Goods receipt → Inventory intake
- Retail checkout → Payment → Finance journal
- HR payroll → Finance payroll execution

### Phase 5: Sync & Offline
- Test sync snapshot/delta endpoints
- Test sync health metrics

## Running
```bash
cd /home/ubuntu/zenvix/e2e-live
chmod +x run-all.sh
./run-all.sh
```

Results are written to `results/` directory.
