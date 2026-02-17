# Contributing to MDXPad

Thank you for your interest in contributing to MDXPad! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Methodology](#development-methodology)
- [Code Conventions](#code-conventions)
- [Testing Requirements](#testing-requirements)
- [Commit Message Format](#commit-message-format)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Common Tasks](#common-tasks)

## Getting Started

Before you begin:

1. **Read the README**: Familiarize yourself with the project by reading [README.md](README.md)
2. **Check existing issues**: Look for existing issues or discussions related to your contribution
3. **Create an issue**: For significant changes, create an issue to discuss your approach before writing code
4. **Review the constitution**: Check `docs/constitution/` for architectural principles and constraints

## Development Setup

### Prerequisites

- **Node.js**: >= 20.19.0
- **pnpm**: >= 10.0.0
- **macOS**: 11.0 (Big Sur) or later
- **Xcode Command Line Tools**: Required for native dependencies

```bash
xcode-select --install
```

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd mdxpad

# Install dependencies
pnpm install

# Run type checking
pnpm typecheck

# Run linter
pnpm lint

# Run tests
pnpm test

# Start development server
pnpm dev
```

### Verify Your Setup

Run the full quality check to ensure everything is working:

```bash
pnpm check
```

This runs typecheck, lint, and test in sequence.

## Development Methodology

MDXPad follows **Specification-Driven Development (SDD)**:

### SDD Workflow

1. **Specification Phase**
   - Write a detailed specification in `docs/specs/`
   - Include rationale, architecture, acceptance criteria
   - Review against the constitution for consistency
   - Get feedback before implementation

2. **Implementation Phase**
   - Implement according to the specification
   - Follow established patterns and conventions
   - Write tests alongside implementation
   - Keep modules under 400 lines

3. **Verification Phase**
   - All tests must pass
   - TypeScript must compile with no errors
   - ESLint must pass with no errors
   - Meet acceptance criteria from the specification

4. **Documentation Phase**
   - Update relevant documentation
   - Add JSDoc comments for public APIs
   - Update CHANGELOG.md if applicable

## Code Conventions

### TypeScript

- **Strict Mode**: Always use TypeScript strict mode
- **Explicit Types**: Prefer explicit types over inference for function signatures
- **No `any`**: Avoid `any` type; use `unknown` if necessary and narrow with type guards
- **No Double Assertions**: Avoid `as unknown as T` patterns
- **Interfaces over Types**: Prefer `interface` for object shapes, `type` for unions/intersections

```typescript
// Good
interface UserData {
  id: string;
  name: string;
}

function getUser(id: string): Promise<UserData> {
  // implementation
}

// Avoid
const getUser = (id) => {
  // implementation
}
```

### File Organization

- **Max File Size**: Keep files under 400 lines
- **Single Responsibility**: Each file should have one clear purpose
- **Barrel Exports**: Use `index.ts` for clean module exports
- **Naming Conventions**:
  - Files: `kebab-case.ts` (e.g., `file-service.ts`)
  - Components: `PascalCase.tsx` (e.g., `EditorPanel.tsx`)
  - Tests: `*.test.ts` or `*.test.tsx`

### Module Structure

Organize modules by feature:

```
feature/
├── index.ts           # Public exports
├── types.ts           # Type definitions
├── component.tsx      # Main component
├── hooks.ts           # React hooks
├── store.ts           # Zustand store
└── __tests__/        # Tests
    └── component.test.tsx
```

### Code Style

- **ESLint**: Follow the project's ESLint configuration
- **Prettier**: Code is automatically formatted
- **Imports**: Group imports logically (external, internal, relative)
- **Constants**: Use UPPER_SNAKE_CASE for constants
- **Functions**: Use descriptive names; prefer verb phrases

```typescript
// Good imports organization
import { useEffect, useState } from 'react';
import { z } from 'zod';

import { useStore } from '@/stores/document-store';
import { validateInput } from '@/lib/validation';

import { LocalComponent } from './local-component';
```

### React Conventions

- **Hooks**: Use React 19 hooks; prefer custom hooks for complex logic
- **Components**: Functional components only
- **Props**: Define explicit interfaces for component props
- **State**: Use Zustand for global state, `useState` for local state
- **Effects**: Minimize `useEffect`; prefer derived state

```typescript
// Good component structure
interface EditorPanelProps {
  initialContent: string;
  onSave: (content: string) => void;
}

export function EditorPanel({ initialContent, onSave }: EditorPanelProps) {
  const [content, setContent] = useState(initialContent);

  // implementation

  return <div>...</div>;
}
```

### Error Handling

- **Validation**: Use Zod for runtime validation
- **Errors**: Create custom error classes when appropriate
- **IPC**: Always validate IPC inputs and outputs
- **User Feedback**: Provide clear error messages

```typescript
// Good error handling
const FilePathSchema = z.string().min(1);

export async function readFile(path: unknown): Promise<string> {
  const validPath = FilePathSchema.parse(path);

  try {
    const content = await fs.readFile(validPath, 'utf-8');
    return content;
  } catch (error) {
    throw new FileReadError(`Failed to read file: ${validPath}`, { cause: error });
  }
}
```

## Testing Requirements

### Test Coverage

- **Unit Tests**: Required for all services, utilities, and stores
- **Component Tests**: Required for complex UI components
- **Integration Tests**: Required for IPC communication
- **E2E Tests**: Required for critical user flows

### Testing Guidelines

- **Test File Location**: Colocate tests in `__tests__/` directory or `*.test.ts` files
- **Test Naming**: Describe behavior, not implementation
- **Arrange-Act-Assert**: Follow AAA pattern
- **Mock Sparingly**: Prefer real implementations when possible

```typescript
// Good test structure
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentStore } from '../document-store';

describe('useDocumentStore', () => {
  beforeEach(() => {
    // Reset store state
    useDocumentStore.getState().reset();
  });

  it('should update content when setContent is called', () => {
    const { result } = renderHook(() => useDocumentStore());

    act(() => {
      result.current.setContent('new content');
    });

    expect(result.current.content).toBe('new content');
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm coverage

# Run E2E tests
pnpm test:e2e
```

### Coverage Requirements

- **Minimum**: 70% overall coverage
- **Critical Paths**: 90%+ coverage for security and data integrity code
- **UI Components**: Focus on behavior, not implementation details

## Commit Message Format

Use **Conventional Commits** format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring without functional changes
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates

### Scope

Use the affected module or feature:
- `editor`: CodeMirror editor
- `preview`: MDX preview
- `fs`: File system
- `ai`: AI provider integration
- `ui`: UI components
- `ipc`: IPC communication
- `store`: Zustand stores

### Examples

```bash
feat(editor): add syntax highlighting for MDX components

Implements syntax highlighting for JSX-like components in MDX files
using CodeMirror's language support. Integrates with existing
theme system.

Closes #123
```

```bash
fix(fs): prevent race condition in file watcher

Adds debouncing to file change events to prevent multiple
rapid updates when external editors save files.

Fixes #456
```

### Commit Best Practices

- **Atomic Commits**: One logical change per commit
- **Clear Subject**: 50 characters or less, imperative mood
- **Detailed Body**: Explain why, not what (code shows what)
- **Reference Issues**: Link to related issues or PRs

## Pull Request Process

### Before Submitting

1. **Update from main**: Rebase your branch on the latest main
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run quality checks**:
   ```bash
   pnpm check
   pnpm audit:types
   ```

3. **Update tests**: Ensure all tests pass and add new tests for your changes

4. **Update documentation**: Update README.md or relevant docs if needed

### PR Guidelines

- **Title**: Use the same format as commit messages
- **Description**: Clearly describe what changed and why
- **Screenshots**: Include screenshots for UI changes
- **Breaking Changes**: Clearly mark breaking changes
- **Related Issues**: Link to related issues

### Review Process

1. **CI Checks**: All CI checks must pass
2. **Code Review**: At least one approval required
3. **Testing**: Reviewer should test the changes locally
4. **Documentation**: Ensure docs are updated
5. **Merge**: Squash and merge with descriptive commit message

## Common Tasks

### Adding a New Feature

1. Create a specification in `docs/specs/`
2. Create a feature branch: `git checkout -b feat/feature-name`
3. Implement according to the spec
4. Add tests
5. Update documentation
6. Submit PR

### Fixing a Bug

1. Create an issue describing the bug
2. Create a fix branch: `git checkout -b fix/bug-description`
3. Write a failing test that reproduces the bug
4. Fix the bug
5. Ensure the test passes
6. Submit PR

### Refactoring Code

1. Ensure tests exist for the code being refactored
2. Make incremental changes
3. Keep tests passing throughout
4. Do not change behavior in a refactoring PR
5. Split large refactorings into multiple PRs

## Getting Help

- **Issues**: Open an issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check `docs/` for detailed information
- **Code Comments**: Read JSDoc comments for API documentation
