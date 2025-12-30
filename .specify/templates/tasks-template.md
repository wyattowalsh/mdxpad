---
description: "Task list template for feature implementation with parallel batch orchestration"
version: "2.0"
---

# Tasks: [FEATURE NAME]

**Feature**: `/specs/[###-feature-name]/`
**Generated**: [TIMESTAMP]
**Orchestration**: [enabled/disabled]

## Prerequisites

| Document | Status | Purpose |
|----------|--------|---------|
| plan.md | Required | Tech stack, structure, dependencies |
| spec.md | Required | User stories with priorities |
| data-model.md | Optional | Entity definitions |
| contracts/ | Optional | API endpoint specifications |
| research.md | Optional | Technical decisions |
| quickstart.md | Optional | Validation scenarios |

---

## Execution Constraints

```yaml
max_parallel_subagents: 3
default_task_timeout: 5m
gate_timeout: 1m
circuit_breaker:
  max_failures_per_batch: 2
  action: pause_and_report
retry_policy:
  max_attempts: 2
  backoff: exponential
```

---

## Quick Start

### Sequential Execution (Simple)

Execute tasks in order: T001 → T002 → T003 → ...

- Run gate validation after each phase completes
- Safe, predictable, no coordination needed

### Parallel Execution (Fast)

1. Identify batch (e.g., all `[P:3.1]` tasks)
2. Spawn subagents for all tasks in batch simultaneously
3. Wait for all to complete
4. Run gate validation
5. Proceed to next batch (`[P:3.2]`)

### Hybrid Execution

- Run Setup and Foundational sequentially (low task count)
- Parallelize within User Story phases (high task count)
- Each story can be worked independently after Foundational

---

## Task Format

```
- [ ] [TaskID] [P:batch-id?] [Story?] Description with file path
```

| Component | Required | Description |
|-----------|----------|-------------|
| `- [ ]` | Yes | Markdown checkbox |
| `[TaskID]` | Yes | Sequential ID: T001, T002, ... |
| `[P:X.Y]` | If parallel | Batch ID (X=phase, Y=batch in phase) |
| `[Story]` | In US phases | User story: [US1], [US2], ... |
| Description | Yes | Action + exact file path |

**Batch rules**:
- Same batch ID = safe to run in parallel (different files, no dependencies)
- Lower batch number runs first: 3.1 → 3.2 → 3.3
- Gate validation between batches

---

## Path Conventions

| Project Type | Source | Tests |
|--------------|--------|-------|
| Single project | `src/` | `tests/` |
| Web app | `backend/src/`, `frontend/src/` | `backend/tests/`, `frontend/tests/` |
| Mobile | `api/src/`, `ios/Sources/`, `android/src/` | Respective test dirs |

Adjust paths based on plan.md project structure.

---

<!--
============================================================================
TEMPLATE INSTRUCTIONS

The sections below contain SAMPLE TASKS for illustration.
The /speckit.tasks command MUST replace these with actual tasks based on:

1. User stories from spec.md (P1, P2, P3 priorities)
2. Tech stack and structure from plan.md
3. Entities from data-model.md
4. Endpoints from contracts/

ORGANIZATION REQUIREMENTS:
- Group tasks into batches using [P:X.Y] notation
- Insert validation gates after each batch
- Each user story phase should be independently completable
- Include context hints for complex tasks

DO NOT keep sample tasks in generated output.
============================================================================
-->

## Phase 1: Setup

**Purpose**: Project initialization and tooling configuration
**Estimated Duration**: 10-15 minutes
**Max Parallelism**: 3 subagents

### Batch 1.1: Project Scaffolding (parallel) ⚡

- [ ] T001 [P:1.1] Create project directory structure per plan.md
- [ ] T002 [P:1.1] Initialize package manager and install dependencies
- [ ] T003 [P:1.1] Configure linting, formatting, and type checking tools

#### Gate 1.1: Setup Validation

```bash
test -d src && test -f pyproject.toml && ty --version
```

**On-Fail**: Verify plan.md has complete project structure definition

---

## Phase 2: Foundational

**Purpose**: Core infrastructure that MUST complete before ANY user story
**Estimated Duration**: 20-30 minutes
**Max Parallelism**: 2 subagents

⚠️ **BLOCKING**: No user story work can begin until this phase completes

### Batch 2.1: Infrastructure (parallel) ⚡

- [ ] T004 [P:2.1] Setup database schema and migrations in src/db/
- [ ] T005 [P:2.1] Configure environment and settings in src/config/settings.py
- [ ] T006 [P:2.1] Setup logging infrastructure in src/core/logging.py

#### Gate 2.1: Infrastructure Validation

```bash
ty src/db/*.py src/config/*.py src/core/logging.py
python -c "from src.config.settings import Settings; from src.core.logging import setup_logging"
```

**On-Fail**: Check plan.md#infrastructure section; verify database connection settings

### Batch 2.2: Framework Setup (parallel) ⚡

<!-- Context: plan.md#api, research.md#framework-decisions -->
- [ ] T007 [P:2.2] Setup API routing and app factory in src/main.py
- [ ] T008 [P:2.2] Implement error handling middleware in src/middleware/errors.py
- [ ] T009 [P:2.2] Create base model classes in src/models/base.py

#### Gate 2.2: Framework Validation

```bash
ty src/main.py src/middleware/*.py src/models/base.py
python -c "from src.main import create_app; app = create_app()"
```

**On-Fail**: Verify framework dependencies installed; check research.md for framework decisions

**✓ Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 — [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description from spec.md]
**Independent Test**: [How to verify this story works standalone]
**Estimated Duration**: 30-45 minutes
**Max Parallelism**: 2 subagents

### Batch 3.1: Models (parallel) ⚡

<!-- Context: plan.md#models, data-model.md#User, data-model.md#Session -->
- [ ] T010 [P:3.1] [US1] Create User model in src/models/user.py
- [ ] T011 [P:3.1] [US1] Create Session model in src/models/session.py

#### Gate 3.1: Model Validation

```bash
ty src/models/user.py src/models/session.py
python -c "from src.models.user import User; from src.models.session import Session"
```

**On-Fail**: Check data-model.md entity definitions; verify base model imports

### Batch 3.2: Services (parallel) ⚡

<!-- Context: plan.md#services, src/models/user.py, contracts/users.yaml -->
- [ ] T012 [P:3.2] [US1] Implement UserService in src/services/user_service.py
- [ ] T013 [P:3.2] [US1] Implement AuthService in src/services/auth_service.py

#### Gate 3.2: Service Validation

```bash
ty src/services/user_service.py src/services/auth_service.py
python -c "from src.services.user_service import UserService; from src.services.auth_service import AuthService"
```

**On-Fail**: Verify model imports work; check contracts/ for method signatures

### Batch 3.3: Endpoints (sequential)

<!-- Context: plan.md#endpoints, src/services/user_service.py, contracts/users.yaml -->
- [ ] T014 [P:3.3] [US1] Implement user registration endpoint in src/api/users.py
- [ ] T015 [P:3.3] [US1] Implement authentication endpoint in src/api/auth.py

#### Gate 3.3: Endpoint Validation

```bash
ty src/api/users.py src/api/auth.py
python -c "from src.api.users import router as users_router; from src.api.auth import router as auth_router"
```

**On-Fail**: Verify service imports; check route registration in main.py

### Batch 3.4: Integration

- [ ] T016 [US1] Wire up User Story 1 routes in src/main.py
- [ ] T017 [US1] Add US1 validation and error handling

#### Gate 3.4: Story Integration

```bash
# Start server and test basic endpoint
python -c "from src.main import create_app; app = create_app()" && \
curl -s http://localhost:8000/health || echo "Manual verification needed"
```

**On-Fail**: Check route registration; verify middleware order

**✓ Checkpoint**: User Story 1 complete — independently functional and testable

---

## Phase 4: User Story 2 — [Title] (Priority: P2)

**Goal**: [Brief description from spec.md]
**Independent Test**: [Verification method]
**Estimated Duration**: 25-35 minutes
**Max Parallelism**: 2 subagents

### Batch 4.1: Models (parallel) ⚡

<!-- Context: plan.md#models, data-model.md#Order -->
- [ ] T018 [P:4.1] [US2] Create Order model in src/models/order.py
- [ ] T019 [P:4.1] [US2] Create OrderItem model in src/models/order_item.py

#### Gate 4.1: Model Validation

```bash
ty src/models/order.py src/models/order_item.py
python -c "from src.models.order import Order; from src.models.order_item import OrderItem"
```

**On-Fail**: Check data-model.md; verify relationship definitions

### Batch 4.2: Services

<!-- Context: plan.md#services, src/models/order.py, contracts/orders.yaml -->
- [ ] T020 [P:4.2] [US2] Implement OrderService in src/services/order_service.py

#### Gate 4.2: Service Validation

```bash
ty src/services/order_service.py
python -c "from src.services.order_service import OrderService"
```

**On-Fail**: Verify Order model exists; check service dependencies

### Batch 4.3: Endpoints

<!-- Context: plan.md#endpoints, src/services/order_service.py, contracts/orders.yaml -->
- [ ] T021 [P:4.3] [US2] Implement order endpoints in src/api/orders.py
- [ ] T022 [US2] Wire up User Story 2 routes and integration

#### Gate 4.3: Endpoint Validation

```bash
ty src/api/orders.py
python -c "from src.api.orders import router as orders_router"
```

**On-Fail**: Verify service imports; check contract specifications

**✓ Checkpoint**: User Story 2 complete — both US1 and US2 independently functional

---

## Phase 5: User Story 3 — [Title] (Priority: P3)

**Goal**: [Brief description from spec.md]
**Independent Test**: [Verification method]
**Estimated Duration**: 20-30 minutes
**Max Parallelism**: 2 subagents

### Batch 5.1: Models (parallel) ⚡

- [ ] T023 [P:5.1] [US3] Create [Entity] model in src/models/[entity].py

#### Gate 5.1: Model Validation

```bash
ty src/models/[entity].py
```

**On-Fail**: Check data-model.md definitions

### Batch 5.2: Services & Endpoints

- [ ] T024 [P:5.2] [US3] Implement [Service] in src/services/[service].py
- [ ] T025 [US3] Implement endpoints and wire up routes

#### Gate 5.2: Full Story Validation

```bash
ty src/services/[service].py src/api/[endpoints].py
```

**On-Fail**: Verify dependencies; check contracts

**✓ Checkpoint**: User Story 3 complete — all stories independently functional

---

<!-- Add more User Story phases as needed following the same pattern -->

---

## Phase N: Polish & Cross-Cutting

**Purpose**: Quality improvements affecting multiple stories
**Estimated Duration**: 15-20 minutes

### Batch N.1: Documentation (parallel) ⚡

- [ ] TXXX [P:N.1] Update API documentation in docs/api.md
- [ ] TXXX [P:N.1] Update README with setup instructions

### Batch N.2: Quality

- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Performance optimization review
- [ ] TXXX Security hardening checklist
- [ ] TXXX Run quickstart.md validation scenarios

#### Gate N.2: Final Validation

```bash
ty src/
pytest tests/ -v --tb=short
```

**On-Fail**: Review test output; check for type errors

---

## Parallel Execution Summary

| Phase | Name | Batches | Tasks | Max Parallel | Critical Path |
|-------|------|---------|-------|--------------|---------------|
| 1 | Setup | 1 | 3 | 3 | T001 |
| 2 | Foundational | 2 | 6 | 2 | T004 → T007 |
| 3 | User Story 1 | 4 | 8 | 2 | T010 → T012 → T014 → T016 |
| 4 | User Story 2 | 3 | 5 | 2 | T018 → T020 → T021 |
| 5 | User Story 3 | 2 | 3 | 2 | T023 → T024 |
| N | Polish | 2 | 5 | 2 | TXXX |
| **Total** | | **14** | **30** | | **Critical: 10 tasks** |

**Parallelism Factor**: 3.0x (30 tasks / 10 critical path)

---

## Dependencies

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← BLOCKS ALL USER STORIES
    ↓
┌───────────────┬───────────────┬───────────────┐
↓               ↓               ↓               ↓
Phase 3 (US1)   Phase 4 (US2)   Phase 5 (US3)   ... (parallel if staffed)
└───────────────┴───────────────┴───────────────┘
                        ↓
                Phase N (Polish)
```

### User Story Independence

| Story | Can Start After | Dependencies on Other Stories |
|-------|-----------------|------------------------------|
| US1 | Phase 2 complete | None |
| US2 | Phase 2 complete | None (or specify if needed) |
| US3 | Phase 2 complete | None (or specify if needed) |

### Critical Path Analysis

```
T001 → T004 → T007 → T010 → T012 → T014 → T016
  ↑       ↑       ↑       ↑       ↑       ↑       ↑
Setup   Found.  Found.  US1     US1     US1     US1
        Batch1  Batch2  Models  Service Endpoint Wire
```

**Bottleneck**: Foundational phase — consider splitting if too long

---

## Batch Execution Examples

### Example: User Story 1 Parallel Execution

```bash
# Batch 3.1: Launch model tasks in parallel
claude-code task "Create User model in src/models/user.py" &
claude-code task "Create Session model in src/models/session.py" &
wait

# Gate 3.1: Validate before proceeding
ty src/models/user.py src/models/session.py
python -c "from src.models.user import User; from src.models.session import Session"

# Batch 3.2: Launch service tasks in parallel
claude-code task "Implement UserService in src/services/user_service.py" &
claude-code task "Implement AuthService in src/services/auth_service.py" &
wait

# Gate 3.2: Validate services
ty src/services/*.py
```

### Example: Multi-Story Parallel (Team Execution)

```bash
# After Phase 2 complete, team splits:

# Developer A: User Story 1
claude-code task "Execute Phase 3 tasks sequentially"

# Developer B: User Story 2
claude-code task "Execute Phase 4 tasks sequentially"

# Developer C: User Story 3
claude-code task "Execute Phase 5 tasks sequentially"

# Sync point: All stories complete → Phase N
```

---

## Implementation Strategy

### MVP First (Recommended)

1. ✅ Complete Phase 1: Setup
2. ✅ Complete Phase 2: Foundational
3. ✅ Complete Phase 3: User Story 1 (MVP)
4. 🧪 **STOP & VALIDATE**: Test US1 independently
5. 🚀 Deploy/demo MVP if ready
6. Continue with US2, US3 incrementally

### Incremental Delivery

| Milestone | Phases Complete | Deliverable |
|-----------|-----------------|-------------|
| Foundation | 1, 2 | Dev environment ready |
| MVP | 1, 2, 3 | Core feature working |
| Beta | 1, 2, 3, 4 | Extended functionality |
| Release | All | Production ready |

### Parallel Team Strategy

| Developer | Assignment | Duration |
|-----------|------------|----------|
| All | Phase 1, 2 (together) | Day 1 AM |
| Dev A | Phase 3 (US1) | Day 1 PM |
| Dev B | Phase 4 (US2) | Day 1 PM |
| Dev C | Phase 5 (US3) | Day 1 PM |
| All | Phase N (Polish) | Day 2 AM |

---

## Recovery Playbook

### Partial Batch Failure

**Symptoms**: Some tasks in batch succeed, others fail

**Recovery**:
1. Check gate output for specific failures
2. Review `.speckit/failed/` for partial artifacts (if orchestration enabled)
3. Fix failing task(s) individually
4. Re-run only failed tasks, not entire batch
5. Re-run gate validation

### Gate Validation Failure

**Symptoms**: All tasks complete but gate fails

**Recovery**:
1. Read gate error output carefully
2. Common causes:
   - Import errors → missing dependency or typo
   - Type errors → run `ty` on specific file for details
   - Missing file → task didn't create expected output
3. Fix identified issue
4. Re-run gate only: copy/paste gate command

### Corrupted State

**Symptoms**: Multiple cascading failures, unclear state

**Recovery**:
1. Identify last successful gate: `git log --oneline | grep speckit-gate`
2. Rollback: `git checkout speckit-gate-{batch_id}`
3. Clear any partial artifacts: `rm -rf .speckit/failed/`
4. Re-run from failed batch

### Cross-Story Dependency Error

**Symptoms**: US2 fails because it needs something from US1

**Recovery**:
1. This indicates a design issue — stories should be independent
2. Options:
   - Move shared component to Foundational phase
   - Complete US1 before starting US2
   - Refactor to remove dependency
3. Update tasks.md to reflect actual dependencies

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Model import fails | Entity name mismatch | Check data-model.md spelling |
| Service can't find model | Model task incomplete | Run gate 3.1 first |
| Type check timeout | Large codebase | Increase gate_timeout or check specific files |
| Route not found | Not registered in main.py | Check wiring task complete |
| Parallel conflict | Same file in batch | Split into sequential sub-batch |

---

## Notes

- **[P:X.Y]** = Batch identifier; same ID means parallel-safe
- **Gates** = Validation checkpoints; don't skip them
- **Checkpoints** = Safe stopping points; story is complete and testable
- Commit after each gate passes
- Each user story should work independently
- Stop at any checkpoint to validate incrementally
- Avoid: vague tasks, missing file paths, same-file conflicts within batches