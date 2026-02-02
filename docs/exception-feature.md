# Exception/Allowlist Feature Implementation

## Overview

The exception feature allows users to block a parent domain while allowing access to specific subdomains. For example, blocking `youtube.com` while allowing `music.youtube.com`.

## Use Cases

- Block YouTube but allow YouTube Music for background music while working
- Block YouTube but allow YouTube Studio for content creators
- Block Reddit but allow specific work-related subreddits
- Block Twitter but allow TweetDeck for social media managers
- Block GitHub but allow specific repositories

## How It Works

### Data Structure

Each blocked site can have an `exceptions` array:

```javascript
{
  id: "uuid",
  pattern: "youtube.com",
  enabled: true,
  addedDate: 1234567890,
  blockCount: 0,
  exceptions: ["music.youtube.com", "studio.youtube.com"]
}
```

### Chrome API Implementation

The key insight is how Chrome's `declarativeNetRequest` API handles domain matching:

#### Problem: Both `urlFilter` and `requestDomains` match subdomains

```javascript
// These BOTH match youtube.com AND all its subdomains:
urlFilter: "||youtube.com"
requestDomains: ["youtube.com"]

// So music.youtube.com gets matched by both
```

#### Solution: Use `excludedRequestDomains`

```javascript
{
  condition: {
    requestDomains: ["youtube.com"],           // Match youtube.com and all subdomains
    excludedRequestDomains: ["music.youtube.com"], // EXCEPT this domain
    resourceTypes: ["main_frame"]
  }
}
```

### Rule Creation Logic

When a site has exceptions:

1. Extract the base domain from the pattern
2. Extract exception domains from the exceptions array
3. Create a rule with:
   - `requestDomains` containing the base domain (matches domain + subdomains)
   - `excludedRequestDomains` containing the exception domains
   - NO `urlFilter` property

**Code (blocking-manager.js):**

```javascript
if (site.exceptions && site.exceptions.length > 0) {
  const baseDomain = site.pattern.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  const exceptionDomains = site.exceptions.map(exc => 
    exc.replace(/^https?:\/\//, '').split('/')[0]
  );
  
  rule.condition.requestDomains = [baseDomain];
  rule.condition.excludedRequestDomains = exceptionDomains;
}
```

## Result

With the rule above:
- ✅ `youtube.com` → **blocked** (matches requestDomains, not excluded)
- ✅ `www.youtube.com` → **blocked** (matches requestDomains, not excluded)
- ✅ `m.youtube.com` → **blocked** (matches requestDomains, not excluded)
- ✅ `music.youtube.com` → **allowed** (matches requestDomains BUT is excluded)
- ✅ `studio.youtube.com` → **allowed if added as exception** (matches requestDomains BUT is excluded)

## User Interface

### Adding an Exception

1. Navigate to Options page → Blocked Sites tab
2. Find the site in the list (e.g., "youtube.com")
3. Click the **"+ Exception"** button
4. Enter the subdomain to allow (e.g., "music.youtube.com")
5. Exception is added and displayed as a tag below the site

### Removing an Exception

1. Click the **✕** button on the exception tag
2. Confirm removal
3. Exception is removed and rules are updated

### Visual Indicators

- Exception count shown in site metadata: "✓ 2 exception(s)"
- Exception tags displayed with green success colors
- Each tag has a remove button (✕)

## API Messages

### Add Exception
```javascript
chrome.runtime.sendMessage({
  type: 'ADD_EXCEPTION',
  data: { 
    siteId: 'uuid',
    exceptionPattern: 'music.youtube.com'
  }
});
```

### Remove Exception
```javascript
chrome.runtime.sendMessage({
  type: 'REMOVE_EXCEPTION',
  data: { 
    siteId: 'uuid',
    exceptionPattern: 'music.youtube.com'
  }
});
```

## Validation

The `isValidException()` method ensures:
- Exception pattern is related to the blocked pattern
- Exception is more specific than the block pattern

```javascript
isValidException('youtube.com', 'music.youtube.com') // true
isValidException('youtube.com', 'facebook.com') // false
```

## Troubleshooting

### Exception not working?

1. **Reload the extension** - Changes require extension reload
2. **Check storage** - Verify exception is in the `exceptions` array
3. **Check rules** - Use `chrome.declarativeNetRequest.getDynamicRules()` to verify
4. **Look for `excludedRequestDomains`** - Should contain the exception domain

### Debug Commands

Check if exception exists in storage:
```javascript
chrome.storage.local.get(['blockedSites'], (data) => {
  const site = data.blockedSites.find(s => s.pattern === 'youtube.com');
  console.log('Exceptions:', site?.exceptions);
});
```

Check the rule:
```javascript
chrome.declarativeNetRequest.getDynamicRules((rules) => {
  const rule = rules.find(r => r.action.redirect?.url.includes('youtube'));
  console.log('Rule condition:', rule?.condition);
});
```

Expected output:
```javascript
{
  requestDomains: ['youtube.com'],
  excludedRequestDomains: ['music.youtube.com'],
  resourceTypes: ['main_frame']
}
```

## Implementation Files

- **Backend Logic:** `src/background/blocking-manager.js`
  - `createRule()` - Adds excludedRequestDomains when exceptions exist
  - `addException()` - Adds exception to site
  - `removeException()` - Removes exception from site
  - `isValidException()` - Validates exception pattern

- **Message Handlers:** `src/background/service-worker.js`
  - `ADD_EXCEPTION` handler
  - `REMOVE_EXCEPTION` handler

- **UI:** `src/options/options.js` and `src/options/options.css`
  - Exception display and management
  - Add/remove exception handlers
  - Exception tag styling

- **Documentation:** `plans/prd-focus-extension.md`
  - Feature requirements
  - User stories
  - Use cases

## Performance Considerations

- Exceptions are processed during rule creation, not at request time
- Chrome evaluates `excludedRequestDomains` efficiently at the browser level
- No performance impact on browsing when exceptions are configured
- Rule updates are atomic and happen instantly

## Limitations

- Exceptions work at the domain level (not path-specific yet)
- Maximum of ~5000 dynamic rules total (Chrome limit)
- Extension must be reloaded after code changes for rules to update

## Future Enhancements

- Path-specific exceptions (e.g., allow `reddit.com/r/programming` but block `reddit.com/r/all`)
- Regex pattern support for advanced users
- Bulk exception management
- Import/export exceptions with block lists
- Exception templates for common use cases
