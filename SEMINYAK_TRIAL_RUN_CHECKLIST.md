# 🏪 SEMINYAK STORE - TRIAL RUN READINESS CHECKLIST

**Store:** Seminyak (SEMINYAK)  
**Trial Date:** June 24, 2026  
**Application:** http://150.109.15.108:3010  
**Tenant:** Bambu Silver (tnt-pfzurx)

---

## ✅ CURRENT STATUS

### 1. ✅ Users & Authentication
- **Status:** READY
- **SPG/Sales Staff Created:** 6 employees
  - Dewa, Dewi, Gusti, Nyoman, Nana, Fera
- **All can login:** Yes, with their @bambusilver.com credentials
- **No schedule required for login:** Schedules are optional for workforce management

### 2. ✅ Store/Branch Setup
- **Status:** READY
- **Seminyak Store:** Created (code: SEMINYAK)
- **Location:** Linked to store
- **Status:** Active

### 3. ⚠️ SHIFT MANAGEMENT - **ACTION REQUIRED**
- **Status:** **MUST OPEN SHIFT BEFORE POS USE**
- **Current State:** No shifts created yet
- **Requirement:** **An active (open) shift is REQUIRED to:**
  - Process any POS transaction
  - Accept payments
  - Process returns
  - Perform stock operations (opname, goods receipt)

**How to Open a Shift:**
1. Sales staff logs in at http://150.109.15.108:3010
2. Navigate to: **Retail → Operational → Shift Control** (or the shift management area)
3. Click "Open Shift" button
4. System creates shift tied to:
   - Employee ID
   - Store (Seminyak)
   - Opening cash amount
   - Timestamp

**Alternative:** Admin can open shift on behalf of staff from management dashboard.

### 4. ❌ PRODUCTS/INVENTORY - **ACTION REQUIRED**
- **Status:** **NOT READY - CRITICAL**
- **Current State:** 0 products in system
- **Impact:** Cannot process any sales without products

**Required Actions:**
1. **Create Product Masters** (Item Masters)
   - Add products with SKU, name, price
   - Assign categories
   - Set tax configuration
   
2. **Stock Assignment**
   - Assign initial stock to Seminyak location
   - Set stock levels for each product
   - Configure pricing

**How to Add Products:**
- Navigate to: **Retail → Management → Inventory** or **Product Catalog**
- Use bulk import (CSV) or manual entry
- Ensure products are linked to Seminyak store

### 5. ⚠️ PAYMENT CONFIGURATION
- **Status:** NEEDS VERIFICATION
- **Payment Methods:** Need to verify configured payment types
  - Cash
  - Card/EDC
  - E-wallet
  - QRIS

**Recommended:** Test with CASH payment first for trial run.

### 6. ⚠️ HARDWARE/DEVICES
- **Status:** OPTIONAL BUT RECOMMENDED
- **POS Devices:** May need to register POS terminals/devices
- **Printers:** Receipt printers (if physical receipts needed)
- **Cash Drawers:** For cash management

---

## 🚫 BLOCKERS FOR TRIAL RUN

### CRITICAL BLOCKERS (Must Fix):
1. **❌ NO PRODUCTS** - Cannot sell without inventory
   - **Action:** Create at least 5-10 test products
   - **Priority:** HIGHEST
   - **ETA:** 30-60 minutes

2. **⚠️ NO ACTIVE SHIFT** - Cannot process transactions
   - **Action:** Open shift for staff member testing POS
   - **Priority:** HIGH
   - **ETA:** 2 minutes

### NON-BLOCKERS (Optional):
- Schedules: Not required for POS operation
- Attendance: Not enforced for POS access
- Performance metrics: Optional workforce analytics

---

## 📋 PRE-TRIAL SETUP STEPS

### Step 1: Add Test Products (Required)
```
Navigate to: Retail → Management → Inventory
1. Click "Add Product" or "Import Products"
2. Add at least 5-10 products with:
   - SKU (e.g., PROD-001)
   - Name (e.g., "Silver Ring - Small")
   - Price (e.g., Rp 150,000)
   - Category (e.g., "Jewelry")
   - Stock Quantity for Seminyak (e.g., 10 units)
3. Save products
```

**Quick Test Products Suggestion:**
- Silver Ring - Small (Rp 150,000)
- Silver Ring - Medium (Rp 200,000)
- Silver Bracelet (Rp 250,000)
- Silver Necklace (Rp 500,000)
- Silver Earrings (Rp 100,000)

### Step 2: Open Shift (Required Before POS)
```
Login as: dewa@bambusilver.com (or any sales staff)
Navigate to: Retail → Operational → [Find Shift Control]
1. Click "Open Shift"
2. Enter opening cash: Rp 500,000 (or appropriate amount)
3. Confirm shift opening
4. System creates active shift
```

### Step 3: Test POS Transaction
```
Navigate to: Retail → Operational → POS Terminal
1. Select products from catalog
2. Add to cart
3. Process checkout
4. Select payment method (CASH recommended for test)
5. Complete transaction
6. Verify receipt/order confirmation
```

---

## 🎯 TRIAL RUN WORKFLOW

### For Today's Test (Recommended Flow):

**Admin/Manager Tasks (do this first):**
1. ✅ Login as Hansel (Superadmin)
2. ⚠️ Add 5-10 test products to inventory
3. ⚠️ Assign stock to Seminyak store
4. ✅ Verify Seminyak store is active

**Sales Staff Tasks (Dewa, Dewi, etc.):**
1. ✅ Login with credentials
2. ⚠️ Open shift with opening cash
3. ✅ Navigate to POS Terminal
4. ⚠️ Test transactions:
   - Add products to cart
   - Process cash payment
   - Print receipt (if printer available)
5. ✅ Test refunds (optional)
6. ✅ Close shift at end of test

---

## ⚡ QUICK START FOR TODAY

**Fastest path to test POS (30 minutes):**

1. **Admin (Hansel)** - 20 mins:
   - Add 5 products manually with prices
   - Set stock quantity for Seminyak = 10 each
   - Verify payment methods enabled

2. **Sales Staff (Dewa)** - 10 mins:
   - Login
   - Open shift (opening cash: Rp 500,000)
   - Test 2-3 transactions
   - Verify orders recorded

---

## 📞 LOGIN CREDENTIALS FOR TRIAL

### Sales Staff (Choose one for testing):
```
Dewa:
Email: dewa@bambusilver.com
Password: Dewa2024!

Dewi:
Email: dewi@bambusilver.com
Password: DewiS2024!
```

### Admin (for setup):
```
Hansel (Superadmin):
Email: hansel@bambusilver.com
Password: Hansel2024!

Ayi (Admin):
Email: ayi@bambusilver.com
Password: Ayi2024!
```

---

## ✅ FINAL VERDICT

### **CAN SPG LOGIN AND ACCESS POS?**
✅ **YES** - No schedule/attendance required

### **CAN SPG PROCESS TRANSACTIONS?**
❌ **NO - NOT YET**
- Need products in inventory (CRITICAL)
- Need active shift (EASY - 2 min fix)

### **ESTIMATED TIME TO READY:**
⏱️ **30-45 minutes** if you add products now

---

## 🚀 RECOMMENDATION

**For successful trial run TODAY:**

1. **PRIORITY 1** (15 mins): Add products via admin account
2. **PRIORITY 2** (2 mins): Open shift when SPG logs in
3. **PRIORITY 3** (15 mins): Run 3-5 test transactions
4. **Optional** (5 mins): Test refund flow

**OR:**

If products take too long, consider:
- Using demo/test mode (if available)
- Creating just 1-2 products for quick test
- Scheduling full inventory setup for tomorrow

---

## 📝 NOTES

- Schedules are for **workforce analytics only**, not POS access control
- Shifts are **mandatory** for all POS operations (security/audit trail)
- Products must exist with stock assigned to Seminyak store
- Cash payment is simplest for initial test
- Each shift must be opened and closed properly

---

**Status:** ⚠️ **NOT READY** (Products + Shift needed)  
**Fix Time:** 30-45 minutes  
**Can Login:** ✅ YES  
**Can Sell:** ❌ NO (yet)
