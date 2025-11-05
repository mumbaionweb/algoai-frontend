# Filter Bot/Scanner 404 Logs in Firebase

## Understanding the Logs

The log shows:
- **User Agent**: `Go-http-client/1.1` - This is a bot/scanner
- **Remote IP**: `157.230.19.140` - Scanner IP
- **Request**: `GET /info.php`
- **Status**: `404` (correct - file doesn't exist)
- **Severity**: `WARNING` (Firebase logs 404s as warnings)

## This is Normal Bot Behavior

Bots/scanners constantly probe for:
- `/info.php`
- `/phpinfo.php`
- `/wp-admin.php`
- `/admin.php`
- And many other common file paths

Your app is working correctly - it's just returning 404s for non-existent files.

## How to Filter These Logs

### Option 1: Filter in Firebase Console

1. Go to [Firebase Console → Logs](https://console.firebase.google.com/project/algo-ai-477010/logs)
2. Use the filter:
   ```
   severity!="WARNING" OR 
   (severity="WARNING" AND NOT httpRequest.requestUrl=~".*\.(php|asp|jsp)$")
   ```
3. Or filter by status:
   ```
   httpRequest.status!=404
   ```

### Option 2: Filter by User Agent

Filter out bot requests:
```
NOT httpRequest.userAgent=~".*Go-http-client.*"
```

### Option 3: Filter by IP (if you know scanner IPs)

```
NOT httpRequest.remoteIp="157.230.19.140"
```

## Recommended Log Filter

To see only real issues, use:
```
severity="ERROR" OR 
(severity="WARNING" AND httpRequest.status>=500) OR
(severity="WARNING" AND NOT httpRequest.userAgent=~".*bot.*|.*scanner.*|.*Go-http-client.*")
```

This will show:
- ✅ All ERROR level logs
- ✅ WARNING logs with 500+ status codes (real errors)
- ✅ Exclude bot/scanner requests

## Summary

- ✅ Your app is working correctly
- ✅ 404s are the correct response for non-existent files
- ✅ These are just bot/scanner probes
- ✅ You can filter them out in Firebase Console logs
- ✅ No code changes needed

The WARNING severity is just Firebase's way of logging 404s - it doesn't mean there's an actual problem.

