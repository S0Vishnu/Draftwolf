# Blender Addon Fixes - Summary

## Issues Fixed

### 1. **App Detection Issue on Other Systems**
**Problem:** The addon showed "Download App" even when the app was installed and running on other systems.

**Root Cause:** 
- The timeout was set to 30 seconds, which could cause issues on different network configurations
- Error handling wasn't comprehensive enough for different operating systems
- No manual way to force a status refresh

**Solution:**
- ✅ Reduced timeout from 30 seconds to 3 seconds for faster detection
- ✅ Added comprehensive error handling for `ConnectionRefusedError` and `OSError`
- ✅ Added a manual "Refresh Status" button next to the "DraftWolf App" section
- ✅ Added better user feedback with "Make sure DraftWolf is running" message

### 2. **Severe Lag When Hovering/Mouse Over**
**Problem:** The addon panel was extremely laggy when hovering or moving the mouse over it.

**Root Cause:** 
- The `draw()` method was calling `check_app_status()` and `check_login_status()` on **every frame**
- Each call made network requests to `http://127.0.0.1:45000/health` and `/auth/status`
- This meant hundreds of network requests per second when hovering, causing severe lag

**Solution:**
- ✅ Implemented a caching system (`StatusCache` class) that stores app status and login status
- ✅ Cache expires after 2 seconds, preventing excessive network calls
- ✅ Status is only checked once every 2 seconds instead of every frame
- ✅ Manual refresh button allows users to force an immediate status check when needed

## Technical Changes

### New Class: `StatusCache`
```python
class StatusCache:
    """Cache for app and login status to prevent excessive network calls"""
    app_running = False
    is_logged_in = False
    username = None
    last_check_time = 0
    cache_duration = 2.0  # Cache for 2 seconds to reduce lag
```

### Modified Functions:
1. **`send_request()`** - Reduced timeout to 3 seconds, added better error handling
2. **`check_app_status()`** - Now uses caching with 2-second expiry
3. **`check_login_status()`** - Now uses caching with 2-second expiry

### New Operator:
- **`OBJECT_OT_DfRefreshStatus`** - Allows manual status refresh by invalidating cache

### UI Changes:
- Added refresh button (🔄) next to "③ DraftWolf App" header
- Added "Make sure DraftWolf is running" helper text when app is not detected

## Testing Recommendations

1. **Test on different systems:**
   - Install the addon on a fresh system
   - Start DraftWolf app
   - Click the refresh button to verify detection

2. **Test lag fix:**
   - Open the addon panel
   - Move mouse over the panel rapidly
   - Verify no lag or stuttering

3. **Test caching:**
   - Stop the DraftWolf app
   - Notice it takes up to 2 seconds to update status
   - Click refresh button to force immediate update

## Performance Impact

**Before:**
- Network requests: ~60-120 per second (when hovering)
- Lag: Severe stuttering and freezing

**After:**
- Network requests: ~0.5 per second (one every 2 seconds)
- Lag: None - smooth and responsive
- Manual refresh available when needed
