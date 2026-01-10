# Editor Troubleshooting Guide

## Common Issues

### Editor Not Rendering

**Symptom**: Empty container, no editor visible

**Solutions**:
1. Verify the container ref is attached: `<div ref={containerRef} />`
2. Check container has height (CodeMirror needs explicit height)
3. Ensure CSS isn't hiding the editor (overflow, display, visibility)

### Theme Not Switching

**Symptom**: Theme prop changes but editor appearance doesn't update

**Solutions**:
1. Theme is one of few props that updates at runtime
2. For other config changes, use React `key` prop to force remount
3. Check browser supports prefers-color-scheme for 'system' theme

### Commands Not Working

**Symptom**: Keyboard shortcuts or executeCommand() not responding

**Solutions**:
1. Verify editor has focus before executing commands
2. Check command name spelling (case-sensitive)
3. Ensure no other key handler is intercepting the shortcut

### Performance Issues

**Symptom**: Laggy typing or slow renders

**Solutions**:
1. Use React.memo wrapper (MDXEditor is memoized by default)
2. Avoid recreating callbacks on every render (use useCallback)
3. For large documents, consider virtual scrolling

### onChange Not Firing

**Symptom**: Content changes but onChange callback not called

**Solutions**:
1. onChange is debounced (default 150ms) - wait for debounce
2. Verify callback is passed to component
3. Check for errors in browser console
