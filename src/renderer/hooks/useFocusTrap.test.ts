/**
 * Tests for useFocusTrap Hook
 *
 * Tests focus trap functionality for modal dialogs and containers.
 *
 * @see useFocusTrap.ts for implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';
import { useRef } from 'react';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock container with focusable elements
 */
function createContainer(focusableCount: number): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);

  for (let i = 0; i < focusableCount; i++) {
    const button = document.createElement('button');
    button.textContent = `Button ${i + 1}`;
    container.appendChild(button);
  }

  return container;
}

/**
 * Create a container with mixed focusable elements
 */
function createMixedContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const input = document.createElement('input');
  input.type = 'text';
  container.appendChild(input);

  const link = document.createElement('a');
  link.href = '#';
  link.textContent = 'Link';
  container.appendChild(link);

  const button = document.createElement('button');
  button.textContent = 'Button';
  container.appendChild(button);

  const select = document.createElement('select');
  container.appendChild(select);

  return container;
}

/**
 * Simulate Tab keypress
 */
function pressTab(element: HTMLElement, shiftKey = false): void {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
}

/**
 * Simulate non-Tab keypress
 */
function pressKey(element: HTMLElement, key: string): void {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
}

beforeEach(() => {
  // Clear document body
  document.body.innerHTML = '';
});

// =============================================================================
// Tests
// =============================================================================

describe('useFocusTrap', () => {
  describe('basic functionality', () => {
    it('should not activate when isActive is false', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, false));

      const buttons = container.querySelectorAll('button');

      // Tab should work normally (not trapped)
      buttons[1]!.focus();
      pressTab(container);

      // Focus should not be trapped
      expect(document.activeElement).not.toBe(buttons[0]);
    });

    it('should activate when isActive is true', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      const buttons = container.querySelectorAll('button');

      // Last button should be focused initially (default autoFocus)
      expect(document.activeElement).toBe(buttons[0]);
    });

    it('should handle null containerRef', () => {
      const containerRef = { current: null };

      // Should not throw
      expect(() => {
        renderHook(() => useFocusTrap(containerRef, true));
      }).not.toThrow();
    });
  });

  describe('focus wrapping', () => {
    it('should wrap from last element to first on Tab', () => {
      const container = createContainer(3);
      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      const buttons = container.querySelectorAll('button');

      // Focus last button
      buttons[2]!.focus();

      // Press Tab - should wrap to first
      pressTab(container);

      expect(document.activeElement).toBe(buttons[0]);
    });

    it('should wrap from first element to last on Shift+Tab', () => {
      const container = createContainer(3);
      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      const buttons = container.querySelectorAll('button');

      // Focus first button
      buttons[0]!.focus();

      // Press Shift+Tab - should wrap to last
      pressTab(container, true);

      expect(document.activeElement).toBe(buttons[2]);
    });

    it('should not wrap when not on boundary elements', () => {
      const container = createContainer(3);
      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      const buttons = container.querySelectorAll('button');

      // Focus middle button
      buttons[1]!.focus();

      // Press Tab - should not affect focus (browser handles it)
      const initialFocus = document.activeElement;
      pressTab(container);

      // Focus shouldn't change (trap only prevents boundary crossing)
      // Note: In real browser, focus would move to next element
      // In test, we just verify trap doesn't interfere with middle elements
      expect(document.activeElement).toBe(initialFocus);
    });
  });

  describe('non-Tab keys', () => {
    it('should not interfere with non-Tab keys', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      const buttons = container.querySelectorAll('button');
      buttons[0]!.focus();

      // Press Enter - should not affect focus
      pressKey(container, 'Enter');

      expect(document.activeElement).toBe(buttons[0]);
    });

    it('should not interfere with arrow keys', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      const buttons = container.querySelectorAll('button');
      buttons[0]!.focus();

      pressKey(container, 'ArrowDown');

      expect(document.activeElement).toBe(buttons[0]);
    });
  });

  describe('autoFocus option', () => {
    it('should auto-focus first element by default', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      const buttons = container.querySelectorAll('button');
      expect(document.activeElement).toBe(buttons[0]);
    });

    it('should auto-focus when autoFocus is true', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true, { autoFocus: true }));

      const buttons = container.querySelectorAll('button');
      expect(document.activeElement).toBe(buttons[0]);
    });

    it('should NOT auto-focus when autoFocus is false', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      const initialFocus = document.activeElement;

      renderHook(() => useFocusTrap(containerRef, true, { autoFocus: false }));

      expect(document.activeElement).toBe(initialFocus);
    });
  });

  describe('restoreFocus option', () => {
    it('should restore focus by default', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      const outsideButton = document.createElement('button');
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      const initialFocus = document.activeElement;

      const { unmount } = renderHook(() => useFocusTrap(containerRef, true));

      // Focus should move to container
      expect(document.activeElement).not.toBe(initialFocus);

      unmount();

      // Focus should be restored
      expect(document.activeElement).toBe(initialFocus);
    });

    it('should restore focus when restoreFocus is true', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      const outsideButton = document.createElement('button');
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      const initialFocus = document.activeElement;

      const { unmount } = renderHook(() =>
        useFocusTrap(containerRef, true, { restoreFocus: true })
      );

      unmount();

      expect(document.activeElement).toBe(initialFocus);
    });

    it('should NOT restore focus when restoreFocus is false', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      const outsideButton = document.createElement('button');
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      const { unmount } = renderHook(() =>
        useFocusTrap(containerRef, true, { restoreFocus: false })
      );

      unmount();

      expect(document.activeElement).not.toBe(outsideButton);
    });

    it('should handle focus restore when previously focused element is removed', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      const outsideButton = document.createElement('button');
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      const { unmount } = renderHook(() => useFocusTrap(containerRef, true));

      // Remove previously focused element
      outsideButton.remove();

      // Should not throw on unmount
      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });

  describe('focusable element selection', () => {
    it('should find buttons', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      const buttons = container.querySelectorAll('button');
      expect(document.activeElement).toBe(buttons[0]);
    });

    it('should find inputs', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const input = document.createElement('input');
      container.appendChild(input);

      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      expect(document.activeElement).toBe(input);
    });

    it('should find links', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const link = document.createElement('a');
      link.href = '#';
      container.appendChild(link);

      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      expect(document.activeElement).toBe(link);
    });

    it('should find selects', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const select = document.createElement('select');
      container.appendChild(select);

      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      expect(document.activeElement).toBe(select);
    });

    it('should find textareas', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const textarea = document.createElement('textarea');
      container.appendChild(textarea);

      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      expect(document.activeElement).toBe(textarea);
    });

    it('should find elements with positive tabindex', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const div = document.createElement('div');
      div.tabIndex = 0;
      container.appendChild(div);

      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      expect(document.activeElement).toBe(div);
    });

    it('should skip disabled elements', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const disabledButton = document.createElement('button');
      disabledButton.disabled = true;
      container.appendChild(disabledButton);

      const enabledButton = document.createElement('button');
      container.appendChild(enabledButton);

      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      expect(document.activeElement).toBe(enabledButton);
    });

    it('should skip elements with tabindex=-1', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      // Use a <div> (not natively focusable) so that the CSS selector
      // [tabindex]:not([tabindex="-1"]) is the only path for matching.
      // A <button> with tabindex=-1 still matches the "button" part of the selector.
      const skipDiv = document.createElement('div');
      skipDiv.setAttribute('tabindex', '-1');
      container.appendChild(skipDiv);

      const normalButton = document.createElement('button');
      container.appendChild(normalButton);

      // jsdom does not implement offsetParent, so mock it for focusable detection
      Object.defineProperty(skipDiv, 'offsetParent', { get: () => container, configurable: true });
      Object.defineProperty(normalButton, 'offsetParent', { get: () => container, configurable: true });

      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      expect(document.activeElement).toBe(normalButton);
    });

    it('should skip hidden elements (offsetParent null)', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const hiddenButton = document.createElement('button');
      hiddenButton.style.display = 'none';
      container.appendChild(hiddenButton);

      const visibleButton = document.createElement('button');
      container.appendChild(visibleButton);

      // jsdom does not implement offsetParent natively, so mock it:
      // hidden element returns null (as it would in a real browser with display:none)
      Object.defineProperty(hiddenButton, 'offsetParent', { get: () => null, configurable: true });
      // visible element returns a non-null parent
      Object.defineProperty(visibleButton, 'offsetParent', { get: () => container, configurable: true });

      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      expect(document.activeElement).toBe(visibleButton);
    });
  });

  describe('edge cases', () => {
    it('should handle container with no focusable elements', () => {
      const container = document.createElement('div');
      container.innerHTML = '<p>No buttons here</p>';
      document.body.appendChild(container);

      const containerRef = { current: container };

      // Should not throw
      expect(() => {
        renderHook(() => useFocusTrap(containerRef, true));
      }).not.toThrow();
    });

    it('should handle container with single focusable element', () => {
      const container = createContainer(1);
      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      const button = container.querySelector('button')!;
      button.focus();

      // Tab should wrap to same element
      pressTab(container);
      expect(document.activeElement).toBe(button);

      // Shift+Tab should also wrap to same element
      pressTab(container, true);
      expect(document.activeElement).toBe(button);
    });

    it('should handle dynamic content changes', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      renderHook(() => useFocusTrap(containerRef, true));

      // Add more buttons dynamically
      const newButton = document.createElement('button');
      newButton.textContent = 'New Button';
      container.appendChild(newButton);

      const buttons = container.querySelectorAll('button');

      // Focus last button
      buttons[buttons.length - 1]!.focus();

      // Tab should wrap to first (including new button in calculation)
      pressTab(container);

      expect(document.activeElement).toBe(buttons[0]);
    });
  });

  describe('lifecycle', () => {
    it('should activate on isActive change from false to true', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      const { rerender } = renderHook(
        ({ isActive }) => useFocusTrap(containerRef, isActive),
        { initialProps: { isActive: false } }
      );

      const buttons = container.querySelectorAll('button');
      expect(document.activeElement).not.toBe(buttons[0]);

      rerender({ isActive: true });

      expect(document.activeElement).toBe(buttons[0]);
    });

    it('should deactivate on isActive change from true to false', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      const { rerender } = renderHook(
        ({ isActive }) => useFocusTrap(containerRef, isActive),
        { initialProps: { isActive: true } }
      );

      const buttons = container.querySelectorAll('button');
      expect(document.activeElement).toBe(buttons[0]);

      rerender({ isActive: false });

      // Trap should be removed (can't easily test this without real focus behavior)
      // Just verify it doesn't throw
      pressTab(container);
    });

    it('should cleanup on unmount', () => {
      const container = createContainer(2);
      const containerRef = { current: container };

      const { unmount } = renderHook(() => useFocusTrap(containerRef, true));

      // Should not throw
      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });
});
