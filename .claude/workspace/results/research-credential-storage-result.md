# Research: Secure Credential Storage for Electron on macOS

**Date**: 2026-01-17
**Context**: AI Provider Abstraction Layer - API key storage for mdxpad
**Target Platform**: macOS (primary), with cross-platform considerations
**Current Electron Version**: 39.x

---

## Decision

**Chosen Library**: **Electron's `safeStorage` API** (built-in)

### Rationale

Electron's `safeStorage` API is the optimal choice because it provides OS-native keychain integration without external dependencies, is actively maintained as part of Electron's core, and offers the best security guarantees for macOS through direct Keychain Access integration. Since mdxpad already uses Electron 39.x (which includes mature safeStorage support introduced in Electron 15), there are no additional dependencies required, eliminating native module compilation issues and simplifying the build process.

### Alternatives Considered

| Option | Rejection Reason |
|--------|------------------|
| **keytar** | Repository archived December 15, 2022. No longer maintained. Native module causes build complexity. Projects (Element, Joplin, VS Code) actively migrating away. |
| **electron-store with encryption** | Uses AES-256-CBC without authentication - vulnerable to bit-flipping attacks. Encryption is for obscurity only, not security. Docs explicitly warn against using for sensitive data. |

---

## Detailed Evaluation

### 1. keytar (atom/node-keytar)

**Status**: DEPRECATED - Repository archived December 15, 2022

| Criterion | Assessment | Score |
|-----------|------------|-------|
| **Security Level** | High - Direct OS keychain access (macOS Keychain, libsecret, Credential Vault) | 5/5 |
| **macOS Keychain Integration** | Excellent - Native binding to Security framework | 5/5 |
| **Ease of Use** | Moderate - Requires native module compilation, platform-specific build setup | 3/5 |
| **Maintenance/Support** | None - Archived, no updates since Dec 2022 | 0/5 |
| **Performance** | Good - Native code, synchronous keychain calls | 4/5 |
| **Session-only Fallback** | Not built-in - Must implement separately | 2/5 |

**Key Issues**:
- Native module requires node-gyp and platform-specific build tools
- Incompatible with newer Electron versions (issues reported with Electron 31+)
- Projects like Element Desktop, Joplin, and Ray have already migrated away
- No security patches or bug fixes available
- Build complexity across platforms (especially Apple Silicon)

**API Example**:
```typescript
import keytar from 'keytar';
await keytar.setPassword('mdxpad', 'openai-api-key', apiKey);
const key = await keytar.getPassword('mdxpad', 'openai-api-key');
```

---

### 2. Electron safeStorage API (RECOMMENDED)

**Status**: ACTIVE - Maintained as part of Electron core (since Electron 15, Sept 2021)

| Criterion | Assessment | Score |
|-----------|------------|-------|
| **Security Level** | High - OS-level encryption using user's secret key | 5/5 |
| **macOS Keychain Integration** | Excellent - Encryption keys stored in Keychain Access, protected from other apps | 5/5 |
| **Ease of Use** | Excellent - Built into Electron, no additional dependencies | 5/5 |
| **Maintenance/Support** | Excellent - Part of Electron core, follows Electron's release cycle | 5/5 |
| **Performance** | Good - Synchronous encryption/decryption, negligible overhead | 4/5 |
| **Session-only Fallback** | Good - `isEncryptionAvailable()` allows graceful degradation | 4/5 |

**macOS Security Model**:
- Encryption keys stored in Keychain Access
- Keys scoped per-app, preventing other applications from loading them without user override
- Protected from other users and apps running in the same userspace
- Leverages Chromium's `os_crypt` under the hood

**API Example**:
```typescript
import { safeStorage } from 'electron';
import Store from 'electron-store';

const store = new Store({ name: 'mdxpad-credentials' });

// Encrypt and store
if (safeStorage.isEncryptionAvailable()) {
  const encrypted = safeStorage.encryptString(apiKey);
  store.set('openai-key', encrypted.toString('latin1'));
}

// Retrieve and decrypt
const encrypted = store.get('openai-key');
const apiKey = safeStorage.decryptString(Buffer.from(encrypted, 'latin1'));
```

**Session-Only Fallback Pattern**:
```typescript
class CredentialManager {
  private sessionCredentials = new Map<string, string>();

  async setCredential(key: string, value: string): Promise<void> {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value);
      this.persistentStore.set(key, encrypted.toString('latin1'));
    } else {
      // Session-only: stored in memory, lost on restart
      this.sessionCredentials.set(key, value);
      this.notifyUser('Credentials stored for this session only');
    }
  }
}
```

**Known Considerations**:
- May prompt for keychain password after Electron upgrades (known issue #43233)
- On Linux without a secret store, falls back to hardcoded password (less secure)
- Blocking calls on macOS when collecting user input

---

### 3. electron-store with Encryption

**Status**: ACTIVE but NOT RECOMMENDED for security-sensitive data

| Criterion | Assessment | Score |
|-----------|------------|-------|
| **Security Level** | Low - Uses AES-256-CBC without authentication (malleable) | 2/5 |
| **macOS Keychain Integration** | None - File-based encryption only | 1/5 |
| **Ease of Use** | Excellent - Simple API, no native dependencies | 5/5 |
| **Maintenance/Support** | Good - Actively maintained by sindresorhus | 4/5 |
| **Performance** | Excellent - Pure JavaScript, very fast | 5/5 |
| **Session-only Fallback** | Not applicable - Always file-based | 2/5 |

**Critical Security Flaw** (documented by security researcher Jesse Li):

The encryption uses AES-256-CBC mode which is **malleable** - an attacker can modify encrypted data without detection. The library's own documentation now explicitly warns:

> "Due to weaknesses in the choice of algorithm aes-256-cbc, electron-store's encryption does NOT ensure the config file's integrity. This allows an attacker to tamper with its contents, which makes it unsafe to use for protecting sensitive data."

**Attack Vector**:
- Bit-flipping attacks allow modification of ciphertext that results in predictable plaintext changes
- ~11.8% success rate for targeted modifications when scrambled block is within a JSON string
- No MAC (Message Authentication Code) to detect tampering

**Intended Use Case**:
- Obscurity only (preventing casual user inspection)
- NOT for cryptographic security
- NOT for API keys or sensitive credentials

---

## Recommendation Summary

### For mdxpad AI Provider Abstraction Layer

**Primary Storage**: `safeStorage` + `electron-store` combination
- Use `safeStorage.encryptString()` for credential encryption
- Use `electron-store` for persisting encrypted blobs
- Implement session-only fallback when keychain unavailable

**Implementation Architecture**:
```
┌─────────────────────────────────────────────────┐
│                 CredentialService               │
├─────────────────────────────────────────────────┤
│  isAvailable(): boolean                         │
│  setCredential(provider, key): Promise<void>    │
│  getCredential(provider): Promise<string|null>  │
│  deleteCredential(provider): Promise<void>      │
│  isSessionOnly(): boolean                       │
└─────────────────────────────────────────────────┘
           │                    │
           ▼                    ▼
┌──────────────────┐  ┌──────────────────┐
│   safeStorage    │  │  SessionStorage  │
│   (persistent)   │  │  (memory-only)   │
│                  │  │                  │
│ macOS: Keychain  │  │ Map<string,str>  │
│ Win: DPAPI       │  │ Cleared on exit  │
│ Linux: libsecret │  │                  │
└──────────────────┘  └──────────────────┘
```

**Requirements Alignment**:
- **FR-002**: OS-native keychain storage (macOS Keychain) - SATISFIED
- **FR-013**: Keychain failure fallback to session-only - SATISFIED via `isEncryptionAvailable()` check
- **SC-002**: No plain text storage - SATISFIED via safeStorage encryption

---

## References

1. [Electron safeStorage Documentation](https://electronjs.org/docs/latest/api/safe-storage)
2. [keytar GitHub (archived)](https://github.com/atom/node-keytar)
3. [Breaking electron-store's encryption - Jesse Li](https://blog.jse.li/posts/electron-store-encryption/)
4. [Replacing Keytar with safeStorage - Freek Van der Herten](https://freek.dev/2103-replacing-keytar-with-electrons-safestorage-in-ray)
5. [Element Desktop keytar migration issue](https://github.com/element-hq/element-desktop/issues/1947)
6. [Joplin keytar replacement issue](https://github.com/laurent22/joplin/issues/8829)
