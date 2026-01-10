/**
 * MDX Runtime Renderer
 *
 * Handles postMessage communication with parent window and renders compiled MDX.
 * @module preview-frame/renderer
 */

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BuiltInComponents } from './components';
import {
  assertNever,
  type ReadySignal,
  type SizeSignal,
  type RuntimeErrorSignal,
  type RenderCommand,
  type ParentToIframeMessage,
} from '@shared/types/preview-iframe';
import {
  createSecureMessageHandler,
  validateParentToIframeMessage,
  createRateLimiter,
  sanitizeErrorMessage,
  sanitizeComponentStack,
} from '@shared/security';

// ============================================================================
// Types
// ============================================================================

/** MDX module shape returned by compiled code */
interface MDXModule {
  default: React.ComponentType<MDXContentProps>;
}

/**
 * Props for MDX components.
 * MDX components receive props dynamically from the MDX runtime.
 * Using Record<string, unknown> provides type safety while allowing
 * flexible prop structures that MDX components require.
 */
interface MDXComponentProps {
  readonly children?: React.ReactNode;
  readonly [key: string]: unknown;
}

/** Props passed to MDX content component */
interface MDXContentProps {
  readonly components?: Readonly<Record<string, React.ComponentType<MDXComponentProps>>>;
  readonly frontmatter?: Record<string, unknown>;
}

// ============================================================================
// Module Cache
// ============================================================================

/** Cache for compiled MDX modules to avoid re-evaluation */
const moduleCache = new Map<string, MDXModule>();
const MAX_CACHE_SIZE = 10;

/**
 * Gets or creates an MDX module from compiled code with caching
 */
function getOrCreateModule(code: string): MDXModule {
  // Check cache first
  const cachedModule = moduleCache.get(code);
  if (cachedModule !== undefined) {
    return cachedModule;
  }

  // Create new module
  const mdxModule = createModuleFromCode(code);

  // Manage cache size (simple LRU: delete oldest when full)
  if (moduleCache.size >= MAX_CACHE_SIZE) {
    const firstKey = moduleCache.keys().next().value;
    if (firstKey !== undefined) {
      moduleCache.delete(firstKey);
    }
  }

  moduleCache.set(code, mdxModule);
  return mdxModule;
}

// ============================================================================
// State
// ============================================================================

/** React root instance */
let root: Root | null = null;

/** Current frontmatter for component access */
let currentFrontmatter: Record<string, unknown> = {};

/** ResizeObserver instance for tracking content size */
let resizeObserver: ResizeObserver | null = null;

/** Last reported height to avoid duplicate signals */
let lastReportedHeight = 0;

/** Current message handler for HMR cleanup */
let currentMessageHandler: ((event: MessageEvent) => void) | null = null;

/** Render counter for ErrorBoundary resetKey (enables recovery from errors) */
let renderCounter = 0;

// ============================================================================
// Message Sending Helpers
// ============================================================================

/**
 * Sends a ready signal to parent window
 */
function sendReadySignal(): void {
  const signal: ReadySignal = { type: 'ready' };
  window.parent.postMessage(signal, '*');
}

/**
 * Sends a size signal to parent window
 */
function sendSizeSignal(height: number): void {
  // Avoid sending duplicate size signals
  if (height === lastReportedHeight) {
    return;
  }
  lastReportedHeight = height;
  const signal: SizeSignal = { type: 'size', height };
  window.parent.postMessage(signal, '*');
}

/**
 * Sends a runtime error signal to parent window.
 *
 * Security: Error messages and component stacks are sanitized before sending
 * to prevent potential XSS or information leakage through error messages.
 */
function sendRuntimeErrorSignal(message: string, componentStack?: string): void {
  // Sanitize error message and component stack before sending
  const sanitizedMessage = sanitizeErrorMessage(message);
  const sanitizedStack = componentStack !== undefined
    ? sanitizeComponentStack(componentStack)
    : undefined;

  const signal: RuntimeErrorSignal = {
    type: 'runtime-error',
    message: sanitizedMessage,
    ...(sanitizedStack !== undefined ? { componentStack: sanitizedStack } : {}),
  };
  window.parent.postMessage(signal, '*');
}

// ============================================================================
// Content Rendering
// ============================================================================

/**
 * Creates an MDX module from compiled code string using new Function()
 * Passes React and components to the module scope for MDX runtime.
 *
 * Note: Using Function constructor is intentional here - MDX compiles to JavaScript
 * that must be evaluated at runtime. The iframe sandbox provides security isolation.
 */
function createModuleFromCode(code: string): MDXModule {
  // The compiled MDX code expects React and components to be available
  // We use new Function() to evaluate the compiled code in a controlled scope
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- MDX runtime requires dynamic code evaluation
  const moduleFactory = new Function('React', 'components', `
    const exports = {};
    const module = { exports };
    ${code}
    return module.exports;
  `);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Function constructor returns typed module
  return moduleFactory(React, BuiltInComponents) as MDXModule;
}

/**
 * Renders MDX content with error boundary
 */
function renderContent(command: RenderCommand): void {
  if (!root) {
    console.error('React root not initialized');
    return;
  }

  // Increment render counter to reset any previous error state in ErrorBoundary
  renderCounter++;

  try {
    // Store frontmatter for component access
    currentFrontmatter = command.frontmatter;

    // Get module from cache or create new one
    const mdxModule = getOrCreateModule(command.code);
    const MDXContent = mdxModule.default;

    // Render with error boundary, passing BuiltInComponents to MDXContent
    // resetKey ensures ErrorBoundary resets when new content is received
    root.render(
      <ErrorBoundary
        resetKey={renderCounter}
        onError={(error, componentStack) => {
          sendRuntimeErrorSignal(error.message, componentStack);
        }}
      >
        <MDXContent
          components={BuiltInComponents as unknown as NonNullable<MDXContentProps['components']>}
          frontmatter={currentFrontmatter}
        />
      </ErrorBoundary>
    );
  } catch (error) {
    // Handle synchronous errors during module creation or initial render
    const message = error instanceof Error ? error.message : String(error);
    console.error('MDX Runtime Error:', error);
    sendRuntimeErrorSignal(message);

    // Render error UI
    root.render(
      <div className="preview-error" role="alert">
        <h3>Runtime Error</h3>
        <p className="preview-error-message">{message}</p>
      </div>
    );
  }
}

// ============================================================================
// Theme Handling
// ============================================================================

/**
 * Applies theme to document
 */
function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', theme);
}

// ============================================================================
// Accessibility Utilities
// ============================================================================

/**
 * Checks if user prefers reduced motion
 *
 * Used to respect user's motion preference per WCAG 2.3.3 (Animation from Interactions).
 * When true, animations and smooth scrolling should be disabled or reduced.
 *
 * @returns true if user has set prefers-reduced-motion to 'reduce'
 */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ============================================================================
// Scroll Handling
// ============================================================================

/**
 * Scrolls to proportional position based on ratio (0-1)
 */
function scrollToRatio(ratio: number): void {
  // Clamp ratio to 0-1
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  // Calculate target scroll position
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const targetY = maxScroll * clampedRatio;

  // Respect user's motion preference per WCAG 2.3.3
  window.scrollTo({
    top: targetY,
    behavior: prefersReducedMotion() ? 'instant' : 'smooth',
  });
}

// ============================================================================
// Size Observation
// ============================================================================

/**
 * Sets up ResizeObserver to track content height changes
 */
function setupResizeObserver(rootElement: HTMLElement): void {
  // Clean up previous observer if it exists (important for HMR)
  resizeObserver?.disconnect();

  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      // Use scrollHeight to get full content height including overflow
      const height = Math.ceil(entry.target.scrollHeight);
      sendSizeSignal(height);
    }
  });

  resizeObserver.observe(rootElement);

  // Send initial size
  sendSizeSignal(Math.ceil(rootElement.scrollHeight));
}

// ============================================================================
// Message Handler
// ============================================================================

/** Rate limiter for incoming messages */
const rateLimiter = createRateLimiter();

/**
 * Handles validated postMessage events from parent window.
 *
 * This is the inner handler that processes validated messages.
 * Origin validation, rate limiting, and Zod schema validation
 * are handled by createSecureMessageHandler wrapper.
 */
function handleValidatedMessage(message: ParentToIframeMessage): void {
  // Handle message types with exhaustive switch
  switch (message.type) {
    case 'render':
      renderContent(message);
      break;
    case 'theme':
      applyTheme(message.value);
      break;
    case 'scroll':
      scrollToRatio(message.ratio);
      break;
    default:
      // Exhaustive check - TypeScript will error if a case is missing
      assertNever(message, 'Unhandled parent-to-iframe message type');
  }
}

/**
 * Creates a secure message handler with all security checks.
 *
 * Security features:
 * - Origin validation (rejects messages from untrusted origins)
 * - Rate limiting (prevents message flooding attacks)
 * - Zod-based message validation (strict type checking)
 *
 * Allowed origins:
 * - 'file://' for Electron's local file protocol
 * - 'null' (string) for sandboxed iframes (per HTML spec)
 * - localhost origins during development
 * - window.location.origin for same-origin contexts
 */
function createMessageHandler(): (event: MessageEvent) => void {
  return createSecureMessageHandler(
    {
      isDev: import.meta.env.DEV,
      currentOrigin: window.location.origin,
      rateLimiter,
      onOriginRejected: (result) => {
        console.warn('[Preview] Rejected message from untrusted origin:', result.origin, result.reason);
      },
      onRateLimitExceeded: () => {
        console.warn('[Preview] Rate limit exceeded for parent messages');
      },
      onValidationFailed: (error, details) => {
        console.warn('[Preview] Message validation failed:', error, details);
      },
    },
    validateParentToIframeMessage,
    handleValidatedMessage
  );
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initializes the preview renderer.
 *
 * Sets up:
 * - React root for content rendering
 * - ResizeObserver for height tracking
 * - Secure message handler with origin validation and rate limiting
 * - Default theme
 */
function initialize(): void {
  // Get root element
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }

  // Initialize default theme
  document.documentElement.setAttribute('data-theme', 'light');

  // Initialize React root
  root = createRoot(rootElement);

  // Set up resize observer
  setupResizeObserver(rootElement);

  // Clean up previous message handler if it exists (important for HMR)
  if (currentMessageHandler) {
    window.removeEventListener('message', currentMessageHandler);
  }

  // Create and register secure message handler
  // This handler includes origin validation, rate limiting, and Zod validation
  currentMessageHandler = createMessageHandler();
  window.addEventListener('message', currentMessageHandler);

  // Send ready signal to parent
  sendReadySignal();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
