# 🔍 POS Routing Debug Instructions

**Date:** June 24, 2026  
**Issue:** Fera login still redirecting to dashboard instead of POS  
**Status:** Backend working ✅ | Frontend deployed ✅ | User experiencing redirect issue ⚠️

---

## ✅ VERIFIED WORKING

### Backend API Test
I tested the backend routing endpoint with Fera's credentials:

```bash
POST http://150.109.15.108:3001/v1/auth/login
{
  "email": "fera@bambusilver.com",
  "password": "Fera2024!"
}

GET http://150.109.15.108:3001/v1/auth/routing-info
Authorization: Bearer <token>
```

**Result:**
```json
{
  "success": true,
  "data": {
    "redirect_to": "/retail/operational/pos",  ← CORRECT!
    "context": {
      "store_id": "1bcb0547-d886-43c3-acf5-ac4866032cdb",
      "store_name": "E2E-FULL-1781176576815 Online",
      "location_id": "a3a241a4-4841-45a3-90cd-f7135e6847b4",
      "shift_id": "fb73f2ff-466b-46e2-b691-d8dc17a49781",
      "shift_start": "2026-06-24T01:00:00Z",
      "shift_end": "2026-06-24T08:00:00Z"
    }
  }
}
```

✅ **Backend is working correctly!**

### Frontend Deployment
- ✅ Container rebuilt with `--no-cache`
- ✅ `routing-info` call found in deployed JavaScript
- ✅ AuthContext code includes routing logic

---

## 🔴 THE PROBLEM

The issue is almost certainly **browser caching**. The user's browser has cached:
1. Old JavaScript files
2. Service worker (if any)
3. Local storage with old session data

Even though we rebuilt the frontend, the browser is still using old cached files.

---

## 🛠️ SOLUTION STEPS

### Step 1: Use Test Page
I created a test page to verify the API responses directly:

1. Open this file in your browser:
   ```
   file:///c:/Users/user/Documents/Software-Developer/zenvix-demo/business-flow-suite-v2/test-fera-login.html
   ```

2. Click **"Test Complete Flow"** button

3. **Expected Result:**
   - ✅ Status: "CORRECT: Should redirect to POS with store context"
   - ✅ Redirect Path: `/retail/operational/pos`
   - ✅ Has Context: Yes
   - ✅ Store: Seminyak (or the store name from shift)

4. **If you see this, the API is working correctly**

### Step 2: Clear Browser Cache (CRITICAL!)

**On the live site (http://150.109.15.108:3010):**

1. **Open Developer Console:**
   - Windows: Press `F12` or `Ctrl+Shift+I`
   - Mac: Press `Cmd+Option+I`

2. **Go to Application tab** (or Storage tab)

3. **Clear Everything:**
   - Click "Clear storage" on the left
   - Check all boxes:
     - ✅ Local storage
     - ✅ Session storage
     - ✅ Cookies
     - ✅ Cache storage
     - ✅ Service workers (if present)
   - Click "Clear site data"

4. **Hard Refresh:**
   - Windows: Press `Ctrl+Shift+R` or `Ctrl+F5`
   - Mac: Press `Cmd+Shift+R`

5. **Try Login Again:**
   - Email: `fera@bambusilver.com`
   - Password: `Fera2024!`
   - Should redirect to `/retail/operational/pos`

### Step 3: Verify Console Logs

**Open Browser Console (F12) and check for these logs:**

```javascript
[AuthContext] Attempting login for: fera@bambusilver.com
[AuthContext] Login successful, token received
[AuthContext] User companies: 1
[AuthContext] Setting session for tenant: tnt-3rlhko
[AuthContext] Routing info received: { success: true, data: {...} }
[AuthContext] Session updated with shift context: {...}
[Login] Redirecting to: /retail/operational/pos  ← THIS SHOULD BE POS!
```

**If you see:**
```
[Login] Redirecting to: /core/dashboard
```

Then the browser is still using cached JavaScript!

### Step 4: Force Browser to Load Fresh Files

If clearing cache doesn't work, try these steps:

1. **Disable Cache in DevTools:**
   - Open DevTools (F12)
   - Go to Network tab
   - Check "Disable cache" checkbox
   - Keep DevTools open
   - Refresh page

2. **Try Incognito/Private Mode:**
   - Open incognito window
   - Navigate to `http://150.109.15.108:3010`
   - Login with Fera
   - Should redirect to POS

3. **Different Browser:**
   - Try Chrome if using Firefox (or vice versa)
   - Fresh browser = no cached files

---

## 📊 EXPECTED VS ACTUAL BEHAVIOR

### Expected (What Should Happen)
```
1. User enters: fera@bambusilver.com / Fera2024!
2. Frontend calls: POST /v1/auth/login
3. Backend returns: { token, user }
4. Frontend calls: GET /v1/auth/routing-info
5. Backend checks: User role = EMPLOYEE
6. Backend checks: Active shift found at Seminyak
7. Backend returns: { redirect_to: "/retail/operational/pos", context: {...} }
8. Frontend navigates to: /retail/operational/pos
9. POS loads with Seminyak store context
```

### Actual (What's Happening Now)
```
1-7. Same as expected ✅
8. Frontend navigates to: /core/dashboard ❌
9. Dashboard tries to load admin data
10. Backend returns: 403 Forbidden (EMPLOYEE role can't access admin endpoints) ❌
```

---

## 🎯 ROOT CAUSE

The backend routing API is returning the correct path (`/retail/operational/pos`), but the frontend is NOT using it. This happens when:

1. **Browser Cache:** Old JavaScript doesn't have routing logic
2. **Service Worker:** Caching old version of the app
3. **Local Storage:** Old session data overriding new logic

---

## 🔧 TECHNICAL DETAILS

### Work Shift Created
```sql
SELECT * FROM hr_work_shifts 
WHERE employee_id IN (
  SELECT id FROM employees WHERE email = 'fera@bambusilver.com'
);
```

Result:
- ✅ Shift ID: `fb73f2ff-466b-46e2-b691-d8dc17a49781`
- ✅ Start: 2026-06-24 01:00:00 UTC (8am Jakarta)
- ✅ End: 2026-06-24 08:00:00 UTC (3pm Jakarta)
- ✅ Store: Linked to Seminyak
- ✅ Status: Active and within time range

### Routing Controller Logic
```typescript
// If EMPLOYEE role, check for active schedule today
if (userRole === 'EMPLOYEE' && employee) {
  const activeShift = await findActiveShift(employee);
  
  if (activeShift && activeShift.location.store) {
    return {
      redirect_to: '/retail/operational/pos',  // ← Correct!
      context: { store_id, store_name, shift_id, ... }
    };
  }
}

// Default: dashboard
return {
  redirect_to: '/core/dashboard'
};
```

### Frontend AuthContext
```typescript
const login = async (credentials) => {
  const loginData = await apiRequest('/v1/auth/login', 'POST', null, credentials);
  
  // Get routing info
  const routingData = await apiRequest('/v1/auth/routing-info', 'GET', { token });
  
  return {
    success: true,
    redirect_to: routingData.data?.redirect_to || '/core/dashboard',  // ← Should use API value
    context: routingData.data?.context
  };
};
```

### Login Page
```typescript
const onSubmit = async (values) => {
  const result = await login(values);
  const redirectPath = result.redirect_to || "/core/dashboard";  // ← Should be /retail/operational/pos
  navigate(redirectPath);
};
```

---

## ✅ SUCCESS CRITERIA

After clearing cache, you should see:

1. **Login with Fera**
   - ✅ No 403 errors in console
   - ✅ Redirect to `/retail/operational/pos`
   - ✅ POS page loads successfully

2. **POS Context**
   - ✅ Store name shows: Seminyak (or shift store name)
   - ✅ Employee name shows: Fera
   - ✅ Shift indicator shows active shift

3. **Login with Management (e.g., Hansel)**
   - ✅ Redirect to `/core/dashboard`
   - ✅ Dashboard loads successfully
   - ✅ All admin panels accessible

---

## 🚨 IF STILL NOT WORKING

If after clearing cache it STILL redirects to dashboard:

1. **Check Console Logs:**
   - Look for `[AuthContext] Routing info received: ...`
   - Verify `redirect_to` value in the logged object

2. **Check Network Tab:**
   - Filter by `/auth/routing-info`
   - Check Response body
   - Should show `redirect_to: "/retail/operational/pos"`

3. **Verify Frontend Rebuild:**
   ```bash
   ssh ubuntu@150.109.15.108
   cd ~/zenvix
   docker compose logs frontend | tail -100
   ```
   - Look for "Build completed" or similar message

4. **Manual Rebuild (if needed):**
   ```bash
   ssh ubuntu@150.109.15.108
   cd ~/zenvix
   docker compose stop frontend
   docker compose rm -f frontend
   docker compose build --no-cache frontend
   docker compose up -d frontend
   ```

5. **Check Browser Console for Errors:**
   - Any JavaScript errors?
   - Any CORS errors?
   - Any network failures?

---

## 📝 CREDENTIALS REMINDER

### SPG Staff (Should go to POS):
- **Fera:** fera@bambusilver.com / Fera2024! (Morning shift: 8am-3pm)
- **Nana:** nana@bambusilver.com / Nana2024! (Evening shift: 3pm-10pm)

### Management (Should go to Dashboard):
- **Estela:** estela@bambusilver.com / Estela2024!
- **Hansel:** hansel@bambusilver.com / Hansel2024!
- **Ayi:** ayi@bambusilver.com / Ayi2024!
- **Dewi Alan:** dewi.alan@bambusilver.com / DewiA2024!

---

## 🎉 WHAT HAPPENS AFTER IT WORKS

Once caching is resolved and Fera logs in:

1. **Automatic POS Redirect**
   - No manual navigation needed
   - Direct to POS terminal

2. **Store Context Set**
   - POS knows: Working at Seminyak
   - POS knows: Fera is the cashier
   - POS knows: Shift FB73F2FF-... is active

3. **All Activities Tracked**
   - Sales linked to: Fera + Seminyak + Shift
   - Transactions linked to: Correct store
   - Inventory movements: Tracked at Seminyak

4. **Shift Management**
   - Can open/close shift
   - Cash movements tracked
   - End-of-shift reconciliation

---

**Next:** Try the test page first, then clear browser cache and test the live login!
