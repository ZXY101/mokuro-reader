# Testing Google Drive Authentication

This guide explains how to test the Google Drive authentication flows without waiting for the 1-hour token expiry.

## Quick Testing Methods

### Method 1: Debug Mode (Fastest - 30 seconds)

1. Open `src/lib/util/google-drive/constants.ts`
2. Change `DEBUG_SHORT_TOKEN_EXPIRY: false` to `DEBUG_SHORT_TOKEN_EXPIRY: true`
3. Build and run the app
4. Sign in to Google Drive
5. Wait 30 seconds - the token will expire and you can test re-authentication

**Console output:**
```
🔧 DEBUG MODE: Token will expire in 30 seconds
```

**⚠️ Remember to set it back to `false` before committing!**

### Method 2: Manual Token Clearing (Instant)

Open browser DevTools console and run:

```javascript
// Test re-authentication (minimal prompt)
localStorage.removeItem('gdrive_token');
localStorage.removeItem('gdrive_token_expires');
// HAS_AUTHENTICATED flag is preserved - next sign-in uses minimal UI

// Test first-time authentication (full consent)
localStorage.clear(); // Clears everything including HAS_AUTHENTICATED
```

### Method 3: Manually Set Expiry Time (Custom timing)

```javascript
// Set token to expire in 1 minute
const oneMinuteFromNow = Date.now() + (60 * 1000);
localStorage.setItem('gdrive_token_expires', oneMinuteFromNow.toString());
```

### Method 4: Revoke Permissions (Test access_denied)

1. Go to https://myaccount.google.com/permissions
2. Find your app in the list
3. Click "Remove access"
4. Try to use Google Drive features in the app
5. Should trigger full consent screen on next sign-in

## Test Scenarios

### ✅ Scenario 1: Normal Re-authentication (Token Expiry)

**Setup:**
- User has authenticated before
- Token has expired

**Expected behavior:**
- Minimal prompt (just account selection)
- No need to re-grant permissions
- Quick re-authentication

**How to test:**
```javascript
// In console:
localStorage.removeItem('gdrive_token');
localStorage.removeItem('gdrive_token_expires');
// Keep HAS_AUTHENTICATED flag
```

### ✅ Scenario 2: Revoked Permissions

**Setup:**
- User has authenticated before
- Permissions were revoked (by user or Google)

**Expected behavior:**
- Full consent screen (`prompt: 'consent'`)
- User must re-grant all permissions
- `HAS_AUTHENTICATED` flag is cleared

**How to test:**
1. Revoke app permissions at https://myaccount.google.com/permissions
2. Try to sync or use Google Drive features
3. Should show "Google Drive access was denied" message
4. Next sign-in shows full consent screen

### ✅ Scenario 3: User Cancels Sign-In

**Setup:**
- User clicks sign-in
- User closes the popup or clicks "Cancel"

**Expected behavior:**
- No state is cleared
- User can retry immediately
- Message: "Sign-in cancelled. Please try again when ready."

**How to test:**
1. Click "Connect to Google Drive"
2. Close the popup window immediately
3. Check that you can retry without issues

### ✅ Scenario 4: First-Time Authentication

**Setup:**
- User has never authenticated before

**Expected behavior:**
- Full consent screen (`prompt: 'consent'`)
- User grants all permissions
- `HAS_AUTHENTICATED` flag is set

**How to test:**
```javascript
// In console:
localStorage.clear(); // Clear all Google Drive state
```

### ✅ Scenario 5: Silent Refresh Attempt

**Setup:**
- Token is about to expire (within 5 minutes)
- Automatic refresh interval triggers

**Expected behavior:**
- Attempts silent refresh (`prompt: ''`)
- If successful, no UI shown
- If fails, shows notification to user

**How to test:**
```javascript
// Set token to expire in 4 minutes
const fourMinutesFromNow = Date.now() + (4 * 60 * 1000);
localStorage.setItem('gdrive_token_expires', fourMinutesFromNow.toString());
// Wait for check interval (2 minutes) - will attempt silent refresh
```

### ✅ Scenario 6: Explicit Logout

**Setup:**
- User clicks "Log out" button

**Expected behavior:**
- Token is revoked server-side
- All state cleared INCLUDING `HAS_AUTHENTICATED` flag
- Next sign-in shows full consent screen

**How to test:**
1. Sign in to Google Drive
2. Click "Log out" button
3. Check localStorage - should be empty
4. Sign in again - should show full consent screen

## Debugging Tips

### Check Current State

```javascript
// Check all Google Drive state
console.log({
  token: localStorage.getItem('gdrive_token'),
  expires: localStorage.getItem('gdrive_token_expires'),
  hasAuth: localStorage.getItem('gdrive_has_authenticated'),
  expiresIn: Math.round((parseInt(localStorage.getItem('gdrive_token_expires')) - Date.now()) / 60000) + ' minutes'
});
```

### Monitor Token Expiry

```javascript
// Watch for expiry warnings
setInterval(() => {
  const expiresAt = localStorage.getItem('gdrive_token_expires');
  if (expiresAt) {
    const timeLeft = parseInt(expiresAt) - Date.now();
    const minutesLeft = Math.round(timeLeft / 60000);
    console.log(`Token expires in ${minutesLeft} minutes`);
  }
}, 30000); // Check every 30 seconds
```

### Test Error Response

```javascript
// Simulate access_denied error (you'll need to modify code temporarily)
// In token-manager.ts callback:
const response = { error: 'access_denied', error_description: 'Test error' };
// Should clear HAS_AUTHENTICATED and show appropriate message
```

## Console Messages Reference

| Message | Meaning |
|---------|---------|
| `🔧 DEBUG MODE: Token will expire in 30 seconds` | Debug mode is active |
| `Token set, expires in X minutes` | Normal token set |
| `Loaded persisted token, expires in X minutes` | Token loaded from localStorage |
| `Token expired or expiring soon, will need re-authentication` | Token cleared on load |
| `Token expiring in X minutes, attempting silent refresh...` | Auto-refresh triggered |
| `Token expires in X minutes` | Periodic check |
| `Token expired, clearing...` | Expiry detected |
| `Silent token refresh failed` | Silent refresh didn't work |
| `Token client error: access_denied` | Permissions denied/revoked |
| `Token client error: popup_closed` | User cancelled sign-in |

## Expected Snackbar Messages

- ✅ `"Google Drive access was denied. Please sign in again to grant permissions."` → Revoked permissions
- ✅ `"Sign-in cancelled. Please try again when ready."` → User closed popup
- ✅ `"Authentication failed. Please try signing in again."` → Other errors
- ✅ `"Google Drive session expired. Please sign in again."` → Token expired
- ✅ `"Google Drive session expires in X minutes. Please re-authenticate to continue."` → Warning before expiry

## Post-Testing Checklist

- [ ] Set `DEBUG_SHORT_TOKEN_EXPIRY` back to `false`
- [ ] Remove any test localStorage modifications
- [ ] Verify full consent flow works for new users
- [ ] Verify minimal prompt works for returning users
- [ ] Verify revoked permissions trigger full consent
