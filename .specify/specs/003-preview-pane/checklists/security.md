# Security Checklist: Preview Pane

**Feature**: 003-preview-pane
**Hardening Level**: C1-H (Hardened Sandbox)
**Constitution Reference**: Article III.5 (Preview Architecture), Article I (Security Priority)
**Last Updated**: 2026-01-09

---

## Overview

The Preview Pane implements a **hardened sandbox model (C1-H)** to enable safe execution of user-authored MDX content. This checklist documents all security controls and provides verification steps for auditing.

### Threat Model

MDXPad is a **local-first editor** where users execute their own MDX code (not untrusted third-party content). The hardened sandbox provides defense-in-depth isolation for the local-first threat model, protecting against:

- Accidental execution of malicious code copied from external sources
- Preview escaping to access parent window context
- Network exfiltration of local data
- File system access from preview code

---

## Security Controls

### 1. Iframe Sandbox Attribute (FR-002)

**Requirement**: Preview iframe MUST use `sandbox="allow-scripts"` only.

**What it prevents**:
- `allow-same-origin` NOT present: Prevents iframe from accessing parent DOM
- `allow-top-navigation` NOT present: Prevents iframe from redirecting parent window
- `allow-forms` NOT present: Prevents form submission from preview
- `allow-popups` NOT present: Prevents opening new windows/tabs

**Implementation Location**:
- Constant: `/Users/ww/dev/projects/mdxpad-preview/src/shared/types/preview-iframe.ts` (line 122)
- Usage: `/Users/ww/dev/projects/mdxpad-preview/src/renderer/components/preview/PreviewFrame.tsx` (line 259)

**Verification Steps**:
- [ ] Confirm `IFRAME_SANDBOX` constant equals `'allow-scripts'` only
- [ ] Confirm `<iframe sandbox={IFRAME_SANDBOX}>` is used in PreviewFrame component
- [ ] Verify no additional sandbox permissions are added anywhere
- [ ] Test: Attempt `window.parent.document` access from preview - should throw SecurityError
- [ ] Test: Attempt `window.open()` from preview - should be blocked
- [ ] Test: Attempt form submission from preview - should be blocked

---

### 2. Content Security Policy (FR-017, Constitution III.5)

**Requirement**: Preview container MUST enforce strict CSP.

**Implemented CSP**:
```
default-src 'none';
script-src 'self' blob:;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'none';
```

**What each directive prevents**:
| Directive | Value | Protection |
|-----------|-------|------------|
| `default-src` | `'none'` | Blocks all resources by default |
| `script-src` | `'self' blob:` | Only local scripts and blob URLs (for compiled MDX) |
| `connect-src` | `'none'` | **Blocks all network requests** (fetch, XHR, WebSocket) |
| `img-src` | `'self' data: blob: https:` | Images allowed but no arbitrary protocol handlers |
| `style-src` | `'self' 'unsafe-inline'` | Allows component styling (unsafe-inline for CSS-in-JS) |
| `font-src` | `'self' data:` | Local fonts only |

**Implementation Location**:
- Constant: `/Users/ww/dev/projects/mdxpad-preview/src/shared/types/preview-iframe.ts` (line 125)
- Meta tag: `/Users/ww/dev/projects/mdxpad-preview/src/preview-frame/index.html` (line 6)

**Verification Steps**:
- [ ] Confirm `IFRAME_CSP` constant matches Constitution III.5 spec
- [ ] Confirm `<meta http-equiv="Content-Security-Policy">` is present in preview HTML
- [ ] Verify CSP in HTML matches `IFRAME_CSP` constant exactly
- [ ] Test: Attempt `fetch('https://example.com')` from preview - should be blocked by CSP
- [ ] Test: Attempt `new WebSocket()` from preview - should be blocked by CSP
- [ ] Test: Verify `<script>` injection via MDX is restricted to blob: URLs

---

### 3. Unidirectional PostMessage (FR-018)

**Requirement**: Communication MUST be unidirectional - parent sends commands, child sends signals only.

**Parent to Iframe (Commands)**:
| Message Type | Purpose | Contains Sensitive Data? |
|--------------|---------|-------------------------|
| `render` | Send compiled MDX code | No (code only, not auth/paths) |
| `theme` | Set light/dark theme | No |
| `scroll` | Sync scroll position | No |

**Iframe to Parent (Signals Only)**:
| Signal Type | Purpose | Contains Data? |
|-------------|---------|----------------|
| `ready` | Iframe initialized | No |
| `size` | Content height changed | Height number only |
| `runtime-error` | Render error occurred | Error message only |

**Implementation Location**:
- Type definitions: `/Users/ww/dev/projects/mdxpad-preview/src/shared/types/preview-iframe.ts`
- Parent handler: `/Users/ww/dev/projects/mdxpad-preview/src/renderer/components/preview/PreviewFrame.tsx` (handleMessage)
- Iframe handler: `/Users/ww/dev/projects/mdxpad-preview/src/preview-frame/renderer.tsx` (handleMessage)

**Verification Steps**:
- [ ] Confirm `ParentToIframeMessage` union only contains render/theme/scroll commands
- [ ] Confirm `IframeToParentMessage` union only contains ready/size/runtime-error signals
- [ ] Verify iframe never sends data queries to parent (no request-response pattern)
- [ ] Verify parent validates message source before processing (`event.source === iframe.contentWindow`)
- [ ] Verify iframe validates message structure before processing (`isParentToIframeMessage`)
- [ ] Test: Attempt to send custom message from iframe requesting data - should be ignored

---

### 4. No Sensitive Data in Messages (FR-026)

**Requirement**: System MUST NOT pass sensitive data to preview iframe.

**What MUST NOT be transmitted**:
- Authentication tokens or API keys
- File system paths (absolute or relative)
- Editor state beyond compiled output
- User preferences containing PII
- Application internals

**What IS transmitted**:
| Field | Content | Rationale |
|-------|---------|-----------|
| `code` | Compiled MDX JavaScript | Required for rendering |
| `frontmatter` | Parsed YAML metadata | User-defined, component access |
| `theme` | `'light'` or `'dark'` | UI synchronization |
| `scrollRatio` | Number 0-1 | Scroll position sync |

**Implementation Location**:
- RenderCommand interface: `/Users/ww/dev/projects/mdxpad-preview/src/shared/types/preview-iframe.ts` (lines 17-23)
- sendRenderCommand: `/Users/ww/dev/projects/mdxpad-preview/src/renderer/components/preview/PreviewFrame.tsx` (lines 97-107)

**Verification Steps**:
- [ ] Confirm RenderCommand only contains `code` and `frontmatter` fields
- [ ] Audit all `postMessage` calls to verify no additional data is sent
- [ ] Verify frontmatter is user-defined only (not application state)
- [ ] Verify no file paths are included in any message type
- [ ] Test: Add console.log in iframe to dump all received messages - verify no sensitive data

---

### 5. Built-in Component Whitelist (FR-009-014)

**Requirement**: Only whitelisted components available in preview.

**Whitelisted Components**:
| Component | Purpose | Risk Level |
|-----------|---------|------------|
| Typography (h1-h6, p, a, ul, ol, li, blockquote, hr, table) | Standard elements | Low |
| `Callout` | Styled alert boxes | Low |
| `CodeBlock` | Syntax highlighted code | Low |
| `Tabs`/`Tab` | Tabbed content | Low |
| `Card`/`CardGrid` | Card layouts | Low |
| `FileTree` | Directory visualization | Low |
| `ErrorBoundary` | Error handling (internal) | Low |

**Implementation Location**:
- Component registry: `/Users/ww/dev/projects/mdxpad-preview/src/preview-frame/components/index.ts`
- Component files: `/Users/ww/dev/projects/mdxpad-preview/src/preview-frame/components/*.tsx`

**Verification Steps**:
- [ ] Confirm `BuiltInComponents` export only contains whitelisted components
- [ ] Verify no network-capable components (e.g., `<iframe>`, `<object>`, `<embed>`)
- [ ] Verify no filesystem-accessing components
- [ ] Verify components do not expose dangerous props (e.g., `dangerouslySetInnerHTML`)
- [ ] Review each component for XSS vulnerabilities
- [ ] Test: Attempt to use unlisted component in MDX - should fail to render

---

### 6. Web Worker Isolation (FR-005)

**Requirement**: MDX compilation MUST run off main thread in isolated Web Worker.

**What this protects**:
- UI remains responsive during compilation (no main thread blocking)
- Compilation errors isolated from main process
- Memory pressure from large documents isolated

**Implementation Location**:
- Worker: `/Users/ww/dev/projects/mdxpad-preview/src/renderer/workers/mdx-compiler.worker.ts`

**Worker Boundaries**:
- Input: `CompileRequest` with `id` and `source` (MDX string) only
- Output: `CompileResponse` with compiled code or errors only
- No DOM access
- No main process IPC
- No file system access

**Verification Steps**:
- [ ] Confirm worker uses `/// <reference lib="webworker" />` directive
- [ ] Verify worker only receives MDX source string (no other application state)
- [ ] Verify worker only returns compiled code or error information
- [ ] Confirm worker has no access to `window`, `document`, or Electron APIs
- [ ] Test: Large document compilation does not freeze UI

---

### 7. Code Execution Security

**Requirement**: User MDX executes in hardened sandbox with honest disclosure.

**Disclosure (FR-025)**:
- UI MUST display indicator: "Preview executes code from your MDX"

**Execution Model**:
1. MDX compiled to JavaScript in Web Worker (isolated)
2. Compiled code sent to iframe via postMessage
3. Iframe executes code via `new Function()` with controlled scope
4. React + BuiltInComponents passed to module scope
5. Error boundary catches runtime errors

**Implementation Location**:
- Code execution: `/Users/ww/dev/projects/mdxpad-preview/src/preview-frame/renderer.tsx` (createModuleFromCode, lines 100-111)

**Verification Steps**:
- [ ] Verify `new Function()` receives only `React` and `components` in scope
- [ ] Verify no Node.js APIs available in execution scope
- [ ] Verify ErrorBoundary wraps all rendered content
- [ ] Verify runtime errors are caught and reported via postMessage
- [ ] Test: Attempt `require()` call in MDX - should fail
- [ ] Test: Attempt `process.env` access in MDX - should fail

---

## Audit Summary

### Pre-Deployment Checklist

| Control | Implemented | Verified | Notes |
|---------|-------------|----------|-------|
| Iframe sandbox (allow-scripts only) | Yes | [ ] | |
| CSP meta tag enforced | Yes | [ ] | |
| Unidirectional postMessage | Yes | [ ] | |
| No sensitive data in messages | Yes | [ ] | |
| Component whitelist | Yes | [ ] | |
| Web Worker isolation | Yes | [ ] | |
| Error boundary protection | Yes | [ ] | |

### Security Testing Commands

```bash
# Run security audit tests (when implemented)
pnpm test:security

# Verify CSP headers
# Open DevTools in preview iframe > Network tab > verify CSP header

# Test sandbox restrictions
# Open DevTools in preview iframe > Console > run:
# window.parent.document  // Should throw SecurityError
# fetch('https://example.com')  // Should be blocked by CSP
```

---

## References

- **Spec**: `/Users/ww/dev/projects/mdxpad-preview/.specify/specs/003-preview-pane/spec.md`
- **Constitution**: `/Users/ww/dev/projects/mdxpad-preview/.specify/memory/constitution.md` (Article III.5)
- **Types**: `/Users/ww/dev/projects/mdxpad-preview/src/shared/types/preview-iframe.ts`
- **PreviewFrame**: `/Users/ww/dev/projects/mdxpad-preview/src/renderer/components/preview/PreviewFrame.tsx`
- **Renderer**: `/Users/ww/dev/projects/mdxpad-preview/src/preview-frame/renderer.tsx`
- **Worker**: `/Users/ww/dev/projects/mdxpad-preview/src/renderer/workers/mdx-compiler.worker.ts`
