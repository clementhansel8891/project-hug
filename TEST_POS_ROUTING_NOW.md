# 🧪 TEST POS ROUTING NOW - Quick Test Guide

**System Status:** 🟢 **LIVE** - Ready for Testing  
**Deployed:** June 24, 2026 14:30 WIB  
**URL:** http://150.109.15.108:3010

---

## 🎯 Quick Test (5 Minutes)

### Test 1: Fera Login ✅
**Time:** June 24, 2026 ~2:30pm WIB (Within Fera's 8am-3pm shift)

```
URL: http://150.109.15.108:3010
Email: fera@bambusilver.com
Password: Fera2024!
```

**✅ Expected Results:**
1. Redirects to `/m/retail/operational/pos`
2. Shows "Seminyak" store name (NOT "E2E-FULL-..." test store)
3. Click "INITIALIZE TERMINAL" → Success (NO "Store Missing" error)
4. Can proceed to POS gateway

**Browser Console Should Show:**
```javascript
[AuthContext] Routing info received: {redirect_to: '/m/retail/operational/pos', context: {...}}
[AuthContext] Session updated with shift context: {
  store_id: 'f6ec35ea-b90c-46cf-ad39-4429f7d48c6e',  // Seminyak ID
  store_name: 'Seminyak',
  ...
}
```

---

### Test 2: Nana Login ✅
**Time:** June 24, 2026 ~2:30pm WIB (Nana's shift starts at 3pm)

```
URL: http://150.109.15.108:3010
Email: nana@bambusilver.com
Password: Nana2024!
```

**✅ Expected Results:**
- Same success as Fera
- Shows "Seminyak" store
- Can initialize terminal

---

### Test 3: Management Login (Control Test) ✅

```
URL: http://150.109.15.108:3010
Email: hansel@bambusilver.com
Password: Hansel2024!
```

**✅ Expected Results:**
- Redirects to `/core/dashboard` (NOT POS)
- No shift context in session

---

## 🔍 What Changed

### The Fix
**Before:** Auth routing picked first store → returned E2E test store  
**After:** Auth routing filters E2E stores → returns real "Seminyak" store

### Store IDs
- ❌ **OLD (Wrong):** `1bcb0547-d886-43c3-acf5-ac4866032cdb` (E2E-FULL-1781176576815 Online)
- ✅ **NEW (Correct):** `f6ec35ea-b90c-46cf-ad39-4429f7d48c6e` (Seminyak BS-03)

---

## 🚨 If Something Goes Wrong

### Scenario 1: Still Shows "Store Missing" Error
**Action:**
1. Open browser console (F12)
2. Look for `store_id` in logs
3. If store_id is `1bcb0547-...` (the E2E store), backend not updated
4. Report: "Backend still returning E2E store"

### Scenario 2: Shows Different Store Name
**Action:**
1. Check what store name appears
2. Open console and find `store_id` value
3. Report: "Shows {store_name} with ID {store_id}"

### Scenario 3: Redirects to Dashboard Instead of POS
**Possible Causes:**
- Outside shift hours (check: Fera 8am-3pm, Nana 3pm-10pm Jakarta time)
- Shift window allows login 2 hours before start
- Nana can login after 1pm Jakarta time (shift starts 3pm)

**Action:**
1. Note current time
2. Report: "Redirected to dashboard at {time} WIB"

---

## ✅ Success Checklist

After testing, confirm:

- [ ] Fera login → Shows "Seminyak" store name
- [ ] Fera login → "INITIALIZE TERMINAL" works (no error)
- [ ] Console logs show correct store_id `f6ec35ea...`
- [ ] Nana login → Same success as Fera
- [ ] Hansel login → Goes to dashboard (not POS)
- [ ] No "Store Missing" errors
- [ ] No console errors

---

## 📊 Backend Verification

**Check Backend Logs:**
```bash
ssh -i "C:\Users\user\.ssh\vps_zenvix" ubuntu@150.109.15.108 "docker logs bfs-backend --tail 50 | grep AuthRouting"
```

**Should See:**
```
[AuthRouting] Resolved store: Seminyak (BS-03) [ID: f6ec35ea-b90c-46cf-ad39-4429f7d48c6e]
[AuthRouting] Available stores at location: 11, filtered to: 1 real stores
```

---

## 🎉 Ready to Test!

**Current System Time:** June 24, 2026 ~14:30 WIB  
**Fera Shift:** 8am-3pm (Currently ACTIVE ✅)  
**Nana Shift:** 3pm-10pm (Starts soon ✅)

**Start with Fera login and verify the complete flow works!**

---

**Documentation:**
- Full details: `POS_ROUTING_FIX_COMPLETE.md`
- Spec: `.kiro/specs/pos-shift-routing-fix/`
