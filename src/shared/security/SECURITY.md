# Security Hardening Documentation

This document describes the security measures implemented in the mdxpad preview system.

## Overview

The preview system uses a sandboxed iframe to render user-provided MDX content. This architecture provides isolation between potentially untrusted content and the main application. The security module in `src/shared/security/` provides additional hardening.

## Security Layers

### 1. Iframe Sandbox

The preview iframe uses the HTML5 sandbox attribute with minimal permissions:

```html
<iframe sandbox="allow-scripts">
```

This restricts the iframe to:
- Execute scripts (required for MDX rendering)
- NO access to parent window APIs
- NO form submission
- NO popups or new windows
- NO top-level navigation
- NO plugins or embedded content

### 2. Content Security Policy (CSP)

The iframe includes a strict CSP that limits what resources can be loaded:

```
default-src 'none';           // Block everything by default
script-src 'self' blob:;      // Only self and blob URLs for scripts
style-src 'self' 'unsafe-inline'; // Allow inline styles (needed for MDX)
img-src 'self' data: blob: https:; // Allow various image sources
font-src 'self' data:;        // Allow self and data: fonts
connect-src 'none';           // Block all network requests
base-uri 'none';              // Prevent base tag injection
object-src 'none';            // Block plugins
form-action 'none';           // Block form submissions
frame-ancestors 'self';       // Only allow embedding in same origin
```

#### Nonce-Based CSP (Optional)

For enhanced security, the system supports nonce-based CSP for inline scripts:

```typescript
import { createNonceCSP } from '@shared/security';

const { nonce, csp, metaTag } = createNonceCSP();
// Use nonce attribute on trusted inline scripts
```

### 3. Origin Validation

All postMessage communication validates origins before processing:

```typescript
import { validateOrigin, isAllowedOrigin } from '@shared/security';

// Strict validation with detailed result
const result = validateOrigin(event.origin, window.location.origin, isDev);
if (!result.allowed) {
  console.warn(`Rejected origin: ${result.reason}`);
  return;
}
```

Allowed origins:
- `file://` - Electron's local file protocol
- `'null'` - Sandboxed iframes (per HTML spec)
- `window.location.origin` - Same origin
- `localhost:*` - Dev mode only

### 4. Message Validation with Zod

All postMessage payloads are validated using Zod schemas:

```typescript
import { validateParentToIframeMessage } from '@shared/security';

const result = validateParentToIframeMessage(event.data);
if (!result.valid) {
  console.error('Invalid message:', result.error);
  return;
}
// result.data is now typed and safe
```

Benefits:
- Type-safe message handling
- Strict schema enforcement
- Size limits to prevent memory exhaustion
- Detailed error reporting

### 5. Rate Limiting

Token bucket rate limiting prevents message flooding:

```typescript
import { createRateLimiter } from '@shared/security';

const limiter = createRateLimiter({
  maxMessages: 100,  // Max messages
  windowMs: 1000,    // Per second
});

if (!limiter.tryConsume()) {
  console.warn('Rate limit exceeded');
  return;
}
```

Default limits:
- 100 messages per second
- Smooth token refill (no burst spikes)
- Stats available for monitoring

### 6. Content Sanitization

User-provided content is sanitized before display:

```typescript
import {
  sanitizeTextContent,
  sanitizeErrorMessage,
  sanitizeComponentStack
} from '@shared/security';

// General text sanitization
const safeText = sanitizeTextContent(userInput, {
  maxLength: 10000,
  allowNewlines: true,
});

// Error message sanitization (removes file paths)
const safeError = sanitizeErrorMessage(error.message);

// Stack trace sanitization (preserves structure)
const safeStack = sanitizeComponentStack(error.componentStack);
```

Sanitization includes:
- HTML entity escaping
- Control character removal
- Dangerous sequence removal (null bytes, BOM)
- Length truncation
- File path redaction in errors

### 7. Resource Integrity

Subresource Integrity (SRI) verification for dynamically loaded content:

```typescript
import {
  computeHash,
  verifyIntegrity,
  createIntegrityAttribute
} from '@shared/security';

// Compute hash for content
const hash = await computeHash(scriptContent, 'sha384');

// Verify content against expected hash
const result = await verifyIntegrity(content, expectedHash);
if (!result.valid) {
  console.error('Integrity check failed:', result.error);
}
```

### 8. Secure Message Handler

Combines all security checks into a single handler:

```typescript
import {
  createSecureMessageHandler,
  validateParentToIframeMessage
} from '@shared/security';

const handler = createSecureMessageHandler(
  {
    isDev: import.meta.env.DEV,
    currentOrigin: window.location.origin,
    onOriginRejected: (result) => console.warn('Origin rejected:', result),
    onRateLimitExceeded: () => console.warn('Rate limit exceeded'),
    onValidationFailed: (error) => console.error('Validation failed:', error),
  },
  validateParentToIframeMessage,
  (message, event) => {
    // Handle validated message
  }
);

window.addEventListener('message', handler);
```

## Security Headers

Recommended security headers for the application:

```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

For Electron apps, these should be set in the main process:

```typescript
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'X-Content-Type-Options': ['nosniff'],
      'X-Frame-Options': ['SAMEORIGIN'],
    },
  });
});
```

## Threat Model

### Mitigated Threats

1. **XSS via MDX Content**: Sandboxed iframe prevents access to parent window
2. **Script Injection**: CSP limits script sources to trusted origins
3. **Data Exfiltration**: CSP blocks network requests from iframe
4. **Clickjacking**: frame-ancestors CSP directive restricts embedding
5. **Message Spoofing**: Origin validation rejects untrusted sources
6. **DoS via Message Flooding**: Rate limiting prevents resource exhaustion
7. **Content Injection**: HTML sanitization prevents XSS in error messages

### Residual Risks

1. **Malicious MDX**: Could consume CPU/memory within iframe (mitigated by iframe isolation)
2. **Side-Channel Attacks**: Timing attacks possible but limited impact
3. **Browser Vulnerabilities**: Rely on browser security for sandbox enforcement

## Security Updates

When updating security:

1. Review CSP directives for any new resource needs
2. Update Zod schemas when message format changes
3. Adjust rate limits based on actual usage patterns
4. Re-evaluate allowed origins when deployment changes

## Audit Checklist

- [ ] Sandbox attribute present on all iframes
- [ ] CSP meta tag present in iframe HTML
- [ ] Origin validation in all message handlers
- [ ] Zod validation for all message types
- [ ] Rate limiting enabled
- [ ] Content sanitization for user-facing strings
- [ ] No `eval()` or `new Function()` outside sandbox (except MDX runtime)
- [ ] No `postMessage(*` with wildcard origin in production code
