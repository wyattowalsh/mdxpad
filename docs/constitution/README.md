# Architectural Constitution

This directory contains the architectural principles and constraints that guide MDXPad development.

## Purpose

The constitution defines non-negotiable architectural decisions that all contributions must respect. These principles ensure consistency, security, and maintainability across the codebase.

## Core Principles

1. **Type Safety First** -- Strict TypeScript mode with comprehensive type definitions; no `any`, minimal type casts
2. **Process Isolation** -- Main, preload, and renderer processes are strictly separated with Zod-validated IPC
3. **Security by Default** -- Context isolation, input validation, CSP nonces, origin validation, rate limiting
4. **Modularity** -- Single-responsibility modules under 400 lines; clear separation of concerns
5. **Testability** -- 80%+ coverage overall, 90%+ for critical paths; AAA pattern; colocated tests
6. **Specification-Driven** -- Non-trivial features require a specification in `docs/specs/` before implementation

## Related Documents

- [AGENTS.md](../../AGENTS.md) -- Full architecture reference and coding standards
- [CONTRIBUTING.md](../../CONTRIBUTING.md) -- Contribution guidelines and workflow
- [Architecture Decision Records](../adr/) -- Documented architectural decisions
- [Specifications](../specs/) -- Feature specifications
