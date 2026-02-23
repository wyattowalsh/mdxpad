# Feature Specifications

This directory contains Specification-Driven Development (SDD) documents for MDXPad features.

## Purpose

Each non-trivial feature or enhancement should have a specification written before implementation. Specifications define the rationale, architecture, acceptance criteria, and testing strategy.

## Specification Template

A specification should include:

1. **Overview** -- What the feature does and why it is needed
2. **Rationale** -- Why this approach was chosen over alternatives
3. **Architecture** -- How it fits into the existing system (process model, data flow)
4. **API / Interface** -- Public APIs, IPC channels, component props
5. **Acceptance Criteria** -- Testable conditions that define "done"
6. **Testing Strategy** -- Unit, integration, and E2E test plans
7. **Security Considerations** -- Any security implications

## Implemented Specifications

| ID  | Name | Status |
|-----|------|--------|
| 000 | Foundational Setup | Implemented |
| 001 | Interface Contracts (IPC) | Implemented |
| 003 | Preview Pane | Implemented |
| 004 | File System Shell | Implemented |
| 005 | Command Palette | Implemented |
| 006 | Application Shell | Implemented |
| 007 | MDX Content Outline | Implemented |
| 011 | Autosave & Recovery | Implemented |
| 014 | Smart Filtering (FZF) | Implemented |
| 016 | Template Library | Implemented |
| 020 | Frontmatter Editor | Implemented |
| 028 | AI Provider Abstraction (BYOK) | Implemented |

## Related Documents

- [AGENTS.md](../../AGENTS.md) -- Architecture reference
- [Architecture Decision Records](../adr/) -- ADRs
- [Constitution](../constitution/) -- Architectural principles
