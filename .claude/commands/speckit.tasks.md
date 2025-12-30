---
description: Generate an actionable, dependency-ordered tasks.md with intelligent parallel batch orchestration for feature implementation.
handoffs:
  - label: Analyze For Consistency
    agent: speckit.analyze
    prompt: Run a project analysis for consistency
    send: true
  - label: Implement Project
    agent: speckit.implement
    prompt: Start the implementation in phases
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Flags

Parse the following flags from user input:

| Flag | Default | Description |
|------|---------|-------------|
| `--orchestration` | false | Emit `tasks.execution.yaml` alongside `tasks.md` |
| `--max-parallel N` | 3 | Maximum concurrent subagents per batch |
| `--no-gates` | false | Omit validation gates (not recommended) |
| `--tdd` | false | Generate test tasks before implementation |

## Outline

1. **Setup**: Run `.specify/scripts/bash/check-prerequisites.sh --json` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load design documents**: Read from FEATURE_DIR:
   - **Required**: plan.md (tech stack, libraries, structure), spec.md (user stories with priorities)
   - **Optional**: data-model.md (entities), contracts/ (API endpoints), research.md (decisions), quickstart.md (test scenarios)
   - Note: Not all projects have all documents. Generate tasks based on what's available.

3. **Build task dependency graph**:
   - Parse plan.md for project structure (directories, file conventions)
   - Extract user stories from spec.md with priorities (P1, P2, P3)
   - If data-model.md exists: Map entities to user stories, identify entity relationships
   - If contracts/ exists: Map endpoints to user stories and their dependent services
   - Build dependency edges:
     - Model → Service (service imports model)
     - Service → Endpoint (endpoint uses service)
     - Implementation → Test (test validates implementation, unless TDD)
     - Shared entity → All consumers (cross-story dependencies)

4. **Execute batch assignment algorithm**:

   ```
   For each phase (Setup, Foundational, UserStory1, UserStory2, ...):

     # Step 1: Identify task types and their outputs
     tasks = get_tasks_for_phase(phase)
     for task in tasks:
       task.output_file = extract_primary_output_file(task)
       task.output_dir = dirname(task.output_file)  # models/, services/, etc.
       task.dependencies = extract_dependencies(task, all_tasks)

     # Step 2: Compute dependency levels (topological sort)
     levels = {}
     for task in tasks:
       if not task.dependencies:
         levels[task] = 0
       else:
         levels[task] = max(levels[dep] for dep in task.dependencies) + 1

     # Step 3: Group into batches by level
     batches = defaultdict(list)
     for task, level in levels.items():
       batch_id = f"{phase.number}.{level + 1}"
       batches[batch_id].append(task)

     # Step 4: Validate file isolation within each batch
     for batch_id, batch_tasks in batches.items():
       files = [t.output_file for t in batch_tasks]
       if len(files) != len(set(files)):
         # Split conflicting tasks into sequential sub-batches
         resolve_file_conflicts(batch_id, batch_tasks)

     # Step 5: Generate validation gate for each batch
     for batch_id, batch_tasks in batches.items():
       gate = generate_gate(batch_tasks)
       # Gate type based on task types in batch:
       # - Models: type check + import test
       # - Services: type check + import test + dependency check
       # - Endpoints: type check + route registration test
       # - Tests: test discovery (not execution)
   ```

5. **Determine context scope for each task**:

   | Task Type | Required Context |
   |-----------|------------------|
   | Project setup | plan.md (full) |
   | Config/infra | plan.md#config, research.md#decisions |
   | Model | plan.md#models, data-model.md#{entity_name} |
   | Service | plan.md#services, dependent model files, contracts/{endpoint}.yaml |
   | Endpoint/Route | plan.md#endpoints, service interfaces, contracts/{endpoint}.yaml |
   | Test (unit) | Implementation file under test |
   | Test (contract) | contracts/{endpoint}.yaml |
   | Test (integration) | spec.md#{user_story}, relevant implementation files |

6. **Generate tasks.md**: Use `.specify/templates/tasks-template.md` as structure, fill with:
   - Feature name from plan.md
   - Execution constraints section
   - Phase 1: Setup tasks (project initialization)
   - Phase 2: Foundational tasks (blocking prerequisites for all user stories)
   - Phase 3+: One phase per user story (in priority order from spec.md)
     - Organize tasks into batches with `[P:X.Y]` notation
     - Insert validation gate after each batch
     - Include batch-level context hints
   - Final Phase: Polish & cross-cutting concerns
   - Parallel Execution Summary table
   - Quick Start section (sequential vs parallel paths)
   - Dependencies section with critical path analysis
   - Recovery Playbook

7. **Generate tasks.execution.yaml** (if --orchestration flag):
   - Machine-readable manifest with:
     - Feature metadata
     - Execution constraints
     - Phase definitions with batch lists
     - Task definitions with context scope, timeout, output files
     - Gate definitions with commands and failure actions
     - Dependency graph edges

8. **Report**: Output path(s) to generated file(s) and summary:
   - Total task count
   - Batch count per phase
   - Critical path (longest sequential chain with task IDs)
   - Parallelism factor (total tasks / critical path length)
   - Max parallelism per phase
   - Estimated time savings (if tasks have timeout estimates)
   - Format validation: Confirm ALL tasks have batch IDs and gates present

Context for task generation: $ARGUMENTS

The tasks.md should be immediately executable - each task must be specific enough that an LLM can complete it without additional context.

---

## Task Generation Rules

**CRITICAL**: Tasks MUST be organized by user story AND grouped into parallelizable batches to enable efficient subagent execution.

**Tests are OPTIONAL**: Only generate test tasks if `--tdd` flag is set or explicitly requested in the feature specification.

### Checklist Format (REQUIRED)

Every task MUST strictly follow this format:

```text
- [ ] [TaskID] [P:batch-id?] [Story?] Description with file path
```

**Format Components**:

1. **Checkbox**: ALWAYS start with `- [ ]` (markdown checkbox)
2. **Task ID**: Sequential number (T001, T002, T003...) in execution order
3. **[P:X.Y] marker**: Batch identifier for parallel execution
   - X = phase number (1 = Setup, 2 = Foundational, 3+ = User Stories)
   - Y = batch within phase (1, 2, 3...)
   - Tasks with SAME batch ID can run in parallel
   - OMIT entirely if task cannot be parallelized (rare)
4. **[Story] label**: REQUIRED for user story phase tasks only
   - Format: [US1], [US2], [US3], etc. (maps to user stories from spec.md)
   - Setup phase: NO story label
   - Foundational phase: NO story label
   - User Story phases: MUST have story label
   - Polish phase: NO story label
5. **Description**: Clear action with exact file path

**Examples**:

- ✅ CORRECT: `- [ ] T001 [P:1.1] Create project structure per implementation plan`
- ✅ CORRECT: `- [ ] T005 [P:2.1] Implement authentication middleware in src/middleware/auth.py`
- ✅ CORRECT: `- [ ] T012 [P:3.1] [US1] Create User model in src/models/user.py`
- ✅ CORRECT: `- [ ] T014 [P:3.2] [US1] Implement UserService in src/services/user_service.py`
- ✅ CORRECT: `- [ ] T020 [US2] Implement OrderService in src/services/order_service.py` (not parallelizable)
- ❌ WRONG: `- [ ] T012 [P] [US1] Create User model` (missing batch ID, missing file path)
- ❌ WRONG: `- [ ] Create User model` (missing ID, batch, story label)
- ❌ WRONG: `T001 [P:1.1] Create model` (missing checkbox)

### Batch Organization Rules

1. **Same batch = truly parallel**:
   - Different output files (no merge conflicts)
   - No dependencies on each other
   - Can execute simultaneously without coordination

2. **Batch ordering**:
   - Lower batch number executes first: 3.1 → 3.2 → 3.3
   - All tasks in batch N must complete before batch N+1 starts
   - Gate validation runs between batches

3. **Typical batch patterns per phase**:

   | Batch | Typical Contents | Gate |
   |-------|------------------|------|
   | X.1 | Models, schemas, types | Type check |
   | X.2 | Services, business logic | Type check + import |
   | X.3 | Endpoints, routes, handlers | Type check + route test |
   | X.4 | Integration, wiring | Smoke test |

4. **Cross-story dependencies**:
   - If US2 needs an entity from US1, that entity goes in Foundational phase
   - Or: US2 explicitly depends on US1 completion (document in Dependencies section)
   - Goal: Each user story phase is independently executable after Foundational

### Gate Definitions

Insert a gate section after each batch:

```markdown
#### Gate X.Y
```bash
# Validation command(s)
ty src/models/*.py
python -c "from src.models import User, Order"
```
**On-Fail**: [Specific recovery guidance for this batch]
```

**Gate types by task type**:

| Task Type | Gate Command | On-Fail Guidance |
|-----------|--------------|------------------|
| Models | `ty {files}` + import test | Check data-model.md definitions |
| Services | `ty {files}` + import test | Verify model dependencies exist |
| Endpoints | `ty {files}` + route registration | Check service interfaces |
| Tests | `pytest --collect-only {files}` | Verify test discovery |
| Config | Config validation script | Check environment variables |

### Context Scope Specification

For each task, determine what context a subagent needs:

```markdown
<!-- Context: plan.md#models, data-model.md#User -->
- [ ] T012 [P:3.1] [US1] Create User model in src/models/user.py
```

Context hints are OPTIONAL in tasks.md but REQUIRED in tasks.execution.yaml.

Use the following scoping rules:

1. **Minimal context**: Only what's needed for this specific task
2. **No full files**: Reference sections, not entire documents
3. **Include dependencies**: If task uses output of T010, include T010's output file
4. **Contracts are precise**: `contracts/users.yaml` not `contracts/`

---

## Task Organization by Phase

### Phase 1: Setup (Batch 1.1 typically)

- Project structure creation
- Dependency installation
- Tooling configuration (linting, formatting, type checking)
- Usually all parallelizable in single batch

### Phase 2: Foundational (Batches 2.1, 2.2, ...)

- Database/storage setup
- Authentication/authorization framework
- Base models shared across stories
- API scaffolding, middleware
- Error handling, logging infrastructure
- **CRITICAL**: Nothing in user story phases can start until Phase 2 completes

### Phase 3+: User Stories (Batches 3.1, 3.2, ... per story)

- One phase per user story, in priority order (P1, P2, P3)
- Each phase contains:
  - Batch X.1: Tests (if TDD) OR Models
  - Batch X.2: Services
  - Batch X.3: Endpoints/UI
  - Batch X.4: Integration/wiring
- Each phase ends with story-level checkpoint

### Final Phase: Polish

- Documentation
- Performance optimization
- Security hardening
- Cross-cutting refactors
- Quickstart validation

---

## Output Artifacts

### tasks.md (Always Generated)

Human-readable task list with:
- Execution constraints
- Batched tasks with `[P:X.Y]` notation
- Validation gates
- Parallel execution summary
- Quick start guide
- Recovery playbook

### tasks.execution.yaml (If --orchestration)

Machine-readable manifest:

```yaml
version: "1.0"
feature: feature-name
generated: "2025-01-15T10:30:00Z"

execution_constraints:
  max_parallel_subagents: 3
  default_task_timeout_seconds: 300
  gate_timeout_seconds: 60
  circuit_breaker:
    max_failures_per_batch: 2
    action: pause_and_report
  retry_policy:
    max_attempts: 2
    backoff: exponential
    initial_delay_seconds: 5

phases:
  - id: phase-1
    name: Setup
    batches:
      - id: "1.1"
        parallel: true
        tasks:
          - id: T001
            description: "Create project structure per implementation plan"
            output_file: null  # No single file
            context_scope:
              - plan.md
            timeout_seconds: 300
          - id: T002
            description: "Initialize Python project with FastAPI dependencies"
            output_file: pyproject.toml
            context_scope:
              - plan.md#dependencies
            timeout_seconds: 180
        gate:
          command: "test -f pyproject.toml && test -d src"
          on_fail: "Verify plan.md project structure section"

  - id: phase-3
    name: "User Story 1 - User Registration"
    depends_on: [phase-2]
    batches:
      - id: "3.1"
        parallel: true
        tasks:
          - id: T012
            description: "Create User model in src/models/user.py"
            output_file: src/models/user.py
            context_scope:
              - plan.md#models
              - data-model.md#User
            timeout_seconds: 300
          - id: T013
            description: "Create Session model in src/models/session.py"
            output_file: src/models/session.py
            context_scope:
              - plan.md#models
              - data-model.md#Session
            timeout_seconds: 300
        gate:
          command: "ty src/models/user.py src/models/session.py && python -c 'from src.models.user import User; from src.models.session import Session'"
          on_fail: "Check data-model.md entity definitions match code"

      - id: "3.2"
        parallel: true
        depends_on: ["3.1"]
        tasks:
          - id: T014
            description: "Implement UserService in src/services/user_service.py"
            output_file: src/services/user_service.py
            context_scope:
              - plan.md#services
              - src/models/user.py
              - contracts/users.yaml
            timeout_seconds: 300
        gate:
          command: "ty src/services/user_service.py && python -c 'from src.services.user_service import UserService'"
          on_fail: "Verify User model exists and is importable"

dependency_graph:
  edges:
    - from: T014
      to: T012
      type: imports
    - from: T015
      to: T014
      type: uses

critical_path:
  tasks: [T001, T004, T007, T012, T014, T016]
  estimated_duration_seconds: 1800

parallelism_analysis:
  total_tasks: 25
  critical_path_length: 6
  parallelism_factor: 4.17
  max_parallelism_by_phase:
    phase-1: 3
    phase-2: 2
    phase-3: 2
    phase-4: 2
```

---

## Execution Model

### Sequential Execution (Default)

Developer executes tasks T001 → T002 → ... in order:
- Simple, predictable
- No coordination needed
- Batch hints indicate safe parallelization opportunities

### Parallel Execution (With Orchestration)

Orchestrator consumes tasks.execution.yaml:

```python
async def execute_phase(manifest: dict, phase_id: str):
    phase = get_phase(manifest, phase_id)

    for batch in phase["batches"]:
        # Check dependencies
        if not all_complete(batch.get("depends_on", [])):
            await wait_for_batches(batch["depends_on"])

        # Spawn parallel subagents
        tasks = []
        for task_def in batch["tasks"]:
            context = load_context(task_def["context_scope"])
            tasks.append(spawn_subagent(
                task=task_def,
                context=context,
                timeout=task_def.get("timeout_seconds", 300)
            ))

        # Wait for batch completion
        results = await gather_with_circuit_breaker(
            tasks,
            max_failures=manifest["execution_constraints"]["circuit_breaker"]["max_failures_per_batch"]
        )

        # Run gate validation
        gate_result = await run_gate(batch["gate"])
        if not gate_result.success:
            handle_gate_failure(batch, gate_result)
            return

        # Auto-commit on success
        git_commit(f"[speckit] Gate {batch['id']} passed")
```

### Failure Handling

1. **Task failure**: Retry per policy, then mark failed
2. **Batch failure (2+ tasks)**: Pause execution, report status
3. **Gate failure**: Pause, surface error, provide recovery guidance
4. **Rollback**: `git checkout speckit-gate-{last_successful_batch}`

---

## Report Format

```
## Task Generation Report

**Feature**: [feature-name]
**Generated**: [timestamp]

### Summary
- Total tasks: 25
- Phases: 5
- Batches: 12

### Parallelism Analysis
| Phase | Batches | Tasks | Max Parallel | Critical Path |
|-------|---------|-------|--------------|---------------|
| Setup | 1 | 3 | 3 | T001 |
| Foundational | 2 | 6 | 2 | T004 → T007 |
| US1 | 3 | 8 | 2 | T012 → T014 → T016 |
| US2 | 3 | 6 | 2 | T018 → T020 → T022 |
| Polish | 3 | 2 | 2 | T024 |

### Critical Path
T001 → T004 → T007 → T012 → T014 → T016
**Length**: 6 tasks
**Parallelism Factor**: 4.17x (25 tasks / 6 critical)

### Validation
✅ All tasks have batch IDs
✅ All batches have gates
✅ All user story tasks have [USn] labels
✅ No file conflicts within batches
✅ Dependency graph is acyclic

### Output Files
- /specs/001-feature-name/tasks.md
- /specs/001-feature-name/tasks.execution.yaml (if --orchestration)
```