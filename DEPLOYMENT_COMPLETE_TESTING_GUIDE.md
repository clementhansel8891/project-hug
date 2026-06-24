# Deployment Complete - Testing Guide

**Date**: June 24, 2026  
**Status**: ✅ DEPLOYED - READY FOR TESTING

---

## What Was Fixed

### 1. ✅ E2E Store Cleanup
- Moved 10 E2E test stores from Seminyak location to separate test location
- Seminyak location now has only 1 store: "Seminyak (BS-03)"
- This eliminates confusion and ensures correct store routing

### 2. ✅ Auth Routing Enhancement
- Improved E2E filtering (checks name AND code)
- Added explicit preference for Seminyak (BS-03) store
- Enhanced logging for better debugging
- Ensures location_id is passed correctly

### 3. ✅ Session & Location Sync
- Auth routing now returns correct location_id with store context
- RetailContext properly updates session location when store changes
- Location checks will now work correctly

---

## Testing Instructions

### Prerequisites
1. **Clear browser cache** (Ctrl+Shift+Del)
2. **Clear local storage** (F12 → Application → Local Storage → Clear)
3. **Log out** if currently logged in

### Test 1: Fresh Login & Store Routing (5 min)

**Steps**:
1. Go to http://150.109.15.108:3010/login
2. Login as Fera: `fera@bambusilver.com` / `Fera2024!`
3. Wait for redirect

**Expected Results**:
- ✅ Redirected to `/m/retail/operational/pos`
- ✅ POS header shows "SEMINYAK" (not "Anchor")
- ✅ Console log shows: `[AuthRouting] ✅ Resolved store: Seminyak (BS-03)`
- ✅ Console log shows: `[RetailContext] Using session store: Seminyak` or NO fallback message
- ✅ No error messages in console

**If it fails**:
- Check browser console for errors
- Take screenshot
- Note what store name is shown

---

### Test 2: Open Shift (2 min)

**Steps**:
1. After login, on POS page
2. Click "INITIALIZE TERMINAL" button
3. Enter opening cash: `1000000` (1 million IDR)
4. Click confirm

**Expected Results**:
- ✅ Shift opens successfully
- ✅ "CLOSE SHIFT" button appears in header
- ✅ Badge shows "Shift Active: XXXXXX"
- ✅ No 403 or location mismatch errors
- ✅ Console shows shift opened at Seminyak location

**If it fails**:
- Note the error message
- Check if it's a location mismatch error
- Check backend logs

---

### Test 3: Process Test Transaction (3 min)

**Steps**:
1. Search for product: "banana" or any product
2. Add to cart
3. Click checkout
4. Select "Cash" payment
5. Enter amount: same as total
6. Complete transaction

**Expected Results**:
- ✅ Transaction completes successfully
- ✅ Receipt generated (or order number shown)
- ✅ No errors
- ✅ Cart clears after transaction

**If it fails**:
- Note at which step it failed
- Check for error messages
- Verify product exists in inventory

---

### Test 4: Close Shift (2 min)

**Steps**:
1. Click "CLOSE SHIFT" button in header
2. Enter closing cash amount
3. Add closing note (optional)
4. Confirm closure

**Expected Results**:
- ✅ **NO 403 FORBIDDEN ERROR** (this was the main bug)
- ✅ Shift closes successfully
- ✅ "CLOSE SHIFT" button disappears
- ✅ Can now logout

**If it fails**:
- Check if error is 403 (location mismatch)
- Check if error is different
- Note the exact error message

---

### Test 5: Logout Flow (1 min)

**Steps**:
1. With shift closed, click logout button (🚪 icon)
2. Wait for redirect

**Expected Results**:
- ✅ Redirected to `/login`
- ✅ Session cleared
- ✅ Can login again

---

### Test 6: Logout Enforcement (1 min)

**Steps**:
1. Login again
2. Open shift
3. Try to click logout button (while shift is open)

**Expected Results**:
- ✅ Toast notification: "Shift Still Active"
- ✅ "Please close your shift before logging out"
- ✅ Stays on POS page (doesn't logout)

---

## Backend Logs Check

If any test fails, check backend logs:

```bash
ssh -i ~/.ssh/vps_zenvix ubuntu@150.109.15.108
docker compose -f ~/zenvix/docker-compose.yml logs backend --tail=100
```

Look for:
- `[AuthRouting]` messages - Shows store resolution
- `[RetailContext]` messages - Shows store selection
- Any error stack traces

---

## Database Verification

After all tests pass, verify data:

```bash
# Check Fera's shift
docker compose exec -T db psql -U zenvix -d zenvix_prod -c "
SELECT rs.id, rs.store_id, s.name as store_name, rs.status, rs.start_time, rs.end_time
FROM retail_shifts rs
JOIN stores s ON rs.store_id = s.id
WHERE rs.employee_id = '66a2b48b-6fdd-4bad-afc9-f29e8b77cd76'
ORDER BY rs.start_time DESC
LIMIT 5;
"

# Check if Seminyak location is clean
docker compose exec -T db psql -U zenvix -d zenvix_prod -c "
SELECT id, name, code, location_id
FROM stores
WHERE location_id = 'a3a241a4-4841-45a3-90cd-f7135e6847b4'
AND deleted_at IS NULL;
"
```

Expected: Only 1 store (Seminyak BS-03) at Seminyak location

---

## Success Criteria

### Must Pass (Critical)
- [ ] Login routes to Seminyak store (not Anchor)
- [ ] Shift opens without errors
- [ ] Shift closes without 403 error
- [ ] Logout works after shift closure
- [ ] Logout blocked when shift is open

### Should Pass (Important)
- [ ] Transaction processes successfully
- [ ] Console logs show correct store
- [ ] No location mismatch errors
- [ ] Database has correct records

### Nice to Have
- [ ] Smooth user experience
- [ ] Fast loading times
- [ ] Clear error messages if any issue

---

## Next Steps After Tests Pass

### Phase 2: Attendance Tracking (2 hours)
- Auto-create attendance on login
- Auto-update attendance on logout
- Calculate work hours

### Phase 3: RBAC & Access Control (1 hour)
- Block SPG from dashboard
- Restrict to retail operational routes
- Add backend permission checks

### Phase 4: Comprehensive Operational Testing (4 hours)
- Test all POS features
- Test all payment methods
- Test refunds/returns
- Test cash management
- Verify data flows to core modules

### Phase 5: Multi-User Testing (1 hour)
- Test Nana's login and shift
- Test concurrent users
- Test shift handoff

---

## Troubleshooting

### Issue: Still shows Anchor store
**Solution**: Clear browser cache completely, logout, login fresh

### Issue: 403 on shift close
**Solution**: Check backend logs for location mismatch details

### Issue: No stores found
**Solution**: Run `listStores` API and check response

### Issue: Shift won't open
**Solution**: Check if there's an existing open shift, run emergency-fix script

---

## Contact/Support

If testing reveals issues:
1. Document exact steps to reproduce
2. Capture screenshots
3. Save console logs
4. Note any error messages
5. Check backend logs

---

**READY TO TEST!** 🎯

Please start with Test 1 (Fresh Login) and report results.
