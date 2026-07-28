# Wind Ability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy wind-blast timer with a deterministic, energy-backed ability state machine integrated into `Game`.

**Architecture:** `WindAbilitySystem` owns the `ready -> charging -> cooldown -> ready` lifecycle and advances only through `update(delta)`. `Game` selects and snapshots the target, delegates timing and energy consumption to the system, and retains the existing visual and physics release order.

**Tech Stack:** JavaScript ES modules, Three.js, Vitest, ESLint, Prettier, Vite.

## Global Constraints

- Use `chargeSeconds: 0.7`, `cooldownSeconds: 0.75`, and `energyCost: 10`.
- Consume energy only when the blast releases.
- Pause cancels a charge without cost and freezes cooldown progress.
- Freeze the selected object identity, origin, target position, power, happiness, and energy at charge start.
- Preserve release order: stop charge pose, release gesture, particle FX, replacement blast velocity.
- Preserve ambient wind as the additive step applied later by `LaboratoryBuilder.update()`.
- Do not modify radial-menu accessibility, raycasting, or E2E tests.
- Remove the legacy timer only after focused replacement tests pass.

---

### Task 1: Deterministic ability system

**Files:**
- Create: `src/abilities/WindAbilityConfig.js`
- Create: `src/abilities/WindAbilitySystem.js`
- Test: `src/__tests__/WindAbilitySystem.test.js`

**Interfaces:**
- Consumes: an owner with numeric `energy` and `startCharging()`, `stopCharging()`, and `releaseWindBlast()` methods.
- Produces: `WindAbilityConfig`; `new WindAbilitySystem({ owner, config, onRelease })`; `start(snapshot)`; `update(delta)`; `pause()`; `resume()`; and `dispose()`.

- [ ] **Step 1: Write failing state-machine tests**

Cover one observable behavior per test: defaults, charge/release/cooldown timing, insufficient energy, pause cancellation, cooldown freeze, immutable snapshot, duplicate starts, invalid deltas, and idempotent disposal.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/__tests__/WindAbilitySystem.test.js`

Expected: FAIL because the config/system modules do not exist.

- [ ] **Step 3: Implement the minimal state machine**

Create immutable defaults and a system that snapshots vectors with `clone()`, changes state through `update(delta)`, subtracts exactly 10 energy on release, and clears callbacks/snapshots on disposal.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/__tests__/WindAbilitySystem.test.js`

Expected: all focused tests PASS with no timers.

### Task 2: Game integration and timer removal

**Files:**
- Modify: `src/main.js`
- Modify: `src/__tests__/GameLifecycle.test.js`

**Interfaces:**
- Consumes: `WindAbilitySystem` from Task 1.
- Produces: `Game.windAbility`, frame-driven release, paused/resumed ability lifecycle, and disposal before owned visual/physics dependencies.

- [ ] **Step 1: Write failing Game lifecycle tests**

Cover charge cancellation without cost, frozen target/origin/attributes, release ordering, replacement velocity before additive ambient wind, cooldown blocking/freezing, frame updates, and disposal.

- [ ] **Step 2: Run focused lifecycle tests and verify RED**

Run: `npm test -- src/__tests__/GameLifecycle.test.js`

Expected: FAIL while `Game` still schedules `setTimeout`.

- [ ] **Step 3: Integrate without removing the legacy timer**

Construct `WindAbilitySystem`, pass a frozen release snapshot into a dedicated blast application method, and advance the system before `WindChild`/FX/laboratory updates.

- [ ] **Step 4: Run both focused suites and verify GREEN**

Run: `npm test -- src/__tests__/WindAbilitySystem.test.js src/__tests__/GameLifecycle.test.js`

Expected: both suites PASS through `update(delta)`.

- [ ] **Step 5: Remove the legacy timer**

Delete `windBlastTimer`, `WIND_CHARGE_DELAY_MS`, `setTimeout`, `clearTimeout`, and `_cancelWindBlast`; route pause/resume/destroy through the ability system.

- [ ] **Step 6: Re-run both focused suites**

Run: `npm test -- src/__tests__/WindAbilitySystem.test.js src/__tests__/GameLifecycle.test.js`

Expected: both suites PASS and Vitest reports zero scheduled timers.

### Task 3: Verification and commit

**Files:**
- Verify only; format changed files if needed.

**Interfaces:**
- Consumes: completed Tasks 1 and 2.
- Produces: a scoped, reviewed commit.

- [ ] **Step 1: Run project gates**

Run: `npm test`, `npm run lint`, `npm run format:check`, and `npm run build`.

Expected: every command exits 0.

- [ ] **Step 2: Review scope and forbidden surfaces**

Run: `git diff --check`, inspect `git diff`, and confirm no changes under `src/ui`, `e2e`, or raycast logic.

- [ ] **Step 3: Commit only ability files**

Stage the two new ability modules, their tests, `src/main.js`, `GameLifecycle.test.js`, and this plan. Commit with `feat: add deterministic wind ability lifecycle`.
