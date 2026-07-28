# Laboratório 3D — Pendências das Fases 2, 3 e 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** concluir os requisitos ainda pendentes das Fases 2, 3 e 4 sem perder o vento ambiente, sem alterar o visual validado nas Fases 1-2 e sem otimizar caminhos que ainda não foram medidos.

**Architecture:** preservar `Game` como coordenador de lifecycle, manter `WindField` como vento contínuo, `WindImpulse` como evento físico instantâneo e `WindParticleSystem` como camada visual. O laboratório será dividido incrementalmente entre composição, arquitetura, portas, objetos de teste e decoração; `RoomData` continuará sendo a fonte única de salas e zonas. As otimizações da Fase 4 só entram depois de uma medição reproduzível em hardware e workload definidos.

**Tech Stack:** JavaScript ES modules com `// @ts-check` e JSDoc, Three.js, Vite, Node.js 24, Vitest, Playwright, ESLint, Prettier e GitHub Actions.

## Global Constraints

- Manter JavaScript por enquanto, usando JSDoc e `// @ts-check`.
- Usar Vitest para testes unitários.
- Usar Playwright para smoke tests.
- Não introduzir ECS completo.
- Preservar o visual atual durante as fases 1 e 2.
- Otimizar somente depois de medir desempenho real.
- O requisito oficial é Node.js 24: `package.json`, `package-lock.json`, `.nvmrc`, CI e README devem permanecer em Node 24.
- Os nomes oficiais são `ALA DE MANEQUINS` e `SALA DE TESTES - CONFIRMED 42`.
- Não adicionar integração de IA, credenciais, prompts, analytics ou serviços externos.
- `Game.destroy()`, `TacMap.destroy()`, `RadialMenu.destroy()`, `HUD.destroy()` e todos os `dispose()` devem ser idempotentes.
- Nenhuma textura compartilhada pelo cache global deve ser liberada pelo laboratório.
- Toda alteração de runtime precisa conservar a ordem existente de input, animação, física, efeitos e renderização, salvo quando este plano declarar a nova ordem.
- Não sobrescrever alterações locais sem primeiro arquivar o diff e obter uma decisão explícita sobre cada grupo de arquivos.
- Cada tarefa termina com teste focado, gate proporcional e commit próprio.

## Estado já validado e escopo restante

Os commits `a40c62a` até `1790f89` já cobrem cache de signage, `RoomData`, ownership/dispose do laboratório, RAF/resize/timers, HUD por delta, navegação estruturada, estado exclusivo do `WindChild`, habilidade com cooldown/energia, `WindImpulse`, menu radial acessível, lint, Prettier, Vitest, Playwright, CI, README, `.gitignore` e Node 24.

Há alterações locais não commitadas no momento da criação deste plano. Elas incluem alterações em `src/main.js`, `src/effects/WindParticleSystem.js`, `src/world/LaboratoryBuilder.js`, `src/world/TestObjectSystem.js`, testes e README, além da remoção local de `src/wind/WindSystem.js`, `WindField.js`, `WindAudio.js`, `WindDustSystem.js` e `WindStreakSystem.js`. Essas alterações parecem tentar unificar o vento, mas ainda não são uma entrega validada; a Tarefa 0 deve preservá-las e decidir seu destino antes de qualquer nova implementação.

---

### Task 0: Preflight e reconciliação das alterações locais de vento

**Files:**
- Create outside the repository: `C:\\tmp\\teste-laboratorio-preflight-2026-07-28.patch`
- Modify: `docs/FASE-1-2-REGISTRO.md`
- Inspect only: `src/main.js`, `src/effects/WindParticleSystem.js`, `src/wind/WindSystem.js`, `src/wind/WindField.js`, `src/wind/WindAudio.js`, `src/wind/WindDustSystem.js`, `src/wind/WindStreakSystem.js`

**Interfaces:**
- Consumes: o branch `refactor/fase-1-lifecycle` e o diff local existente.
- Produces: um snapshot recuperável, um relatório de baseline e uma decisão registrada: preservar, adaptar ou descartar cada grupo de mudanças locais.

- [ ] **Step 1: Arquivar o diff sem modificar o worktree**

```powershell
git status --short
git diff --binary > C:\\tmp\\teste-laboratorio-preflight-2026-07-28.patch
git diff --stat
```

Esperado: o arquivo `.patch` contém também as remoções dos cinco módulos de vento; nenhuma alteração é perdida.

- [ ] **Step 2: Executar o baseline antes de interpretar o diff**

```powershell
node --version
npm run lint
npm run format:check
npm test
npm run build
```

Esperado: registrar em `docs/FASE-1-2-REGISTRO.md` quais comandos falham por causa das remoções locais. Não transformar uma falha de baseline em “bug novo” sem comparar com `git show HEAD:<arquivo>`.

- [ ] **Step 3: Comparar os contratos antigos e novos**

Verificar com `git show HEAD:src/wind/WindSystem.js` e buscas por `samplePlayerForce`, `applyToObjects`, `startAudio`, `suspendAudio`, `resumeAudio`, `WindField.sample` e `WindParticleSystem.triggerWindBlast`. Produzir uma tabela no registro com chamada, consumidor, estado atual e decisão.

- [ ] **Step 4: Isolar a implementação escolhida**

Criar uma branch de trabalho a partir do estado atual e não usar `git reset --hard` nem `git checkout --` sobre os arquivos locais. Se a decisão for restaurar os módulos de vento, aplicar o patch arquivado em um worktree separado ou reconstruir os arquivos a partir de `HEAD`; só depois de comparar o diff e verificar que o ambient wind continua disponível.

- [ ] **Step 5: Commitar somente o registro do preflight**

```powershell
git add docs/FASE-1-2-REGISTRO.md
git commit -m "docs: record pending wind reconciliation"
```

Gate: o patch de backup existe, a decisão está documentada e o build não fica sem uma fonte de vento ambiente silenciosamente.

---

### Task 1: Restaurar e unificar vento contínuo e impulso instantâneo

**Files:**
- Create or restore: `src/wind/WindField.js`, `src/wind/WindSystem.js`, `src/wind/WindAudio.js`, `src/wind/WindDustSystem.js`, `src/wind/WindStreakSystem.js`
- Modify: `src/wind/WindImpulse.js`
- Modify: `src/effects/WindParticleSystem.js`
- Modify: `src/world/TestObjectSystem.js`
- Modify: `src/world/LaboratoryBuilder.js`
- Modify: `src/main.js`
- Create or extend: `src/__tests__/WindField.test.js`, `src/__tests__/WindSystem.test.js`, `src/__tests__/WindImpulse.test.js`

**Interfaces:**
- `WindField.update(delta)` advances continuous flow; `WindField.sample(position, out)` writes a reusable `THREE.Vector3`; `WindField.getStrengthAt(position)` returns the zone strength.
- `WindImpulse.create({ origin, direction, power, radius, falloff, verticalLift, duration, source })` returns a frozen impulse with cloned vectors.
- `WindSystem.update(delta)`, `WindSystem.samplePlayerForce(position, out)`, `WindSystem.applyToObjects(objects, delta)`, `WindSystem.applyImpulse(impulse, objects)`, `startAudio()`, `suspendAudio()`, `resumeAudio()` and `dispose()` remain callable by `Game`.
- `TestObjectSystem.update(delta, windSystem)` applies continuous wind and then integrates objects; `applyWindImpulse` remains the compatibility adapter for the existing blast profiles.

- [ ] **Step 1: Write RED tests for the two force sources**

Cover deterministic zone intensity and direction from `WindField`, additive ambient velocity, impulse falloff at `distance = 0`, `distance = radius` and outside radius, vertical lift, source metadata, and preservation of the existing cardboard/rock/leaf thresholds.

```js
const impulse = createWindImpulse({
  origin: new THREE.Vector3(0, 0, 0),
  direction: new THREE.Vector3(1, 0, 0),
  power: 4,
  radius: 6,
  falloff: 'linear',
  verticalLift: 1.5,
  duration: 0.2,
  source: 'blast',
});
expect(impulse.direction.length()).toBeCloseTo(1);
expect(applyWindImpulseToObject(object, impulse, 0)).toBe(true);
```

- [ ] **Step 2: Run RED and capture the missing contract**

```powershell
npm test -- src/__tests__/WindField.test.js src/__tests__/WindSystem.test.js src/__tests__/WindImpulse.test.js
```

Esperado: falha por ausência do factory/adapter e por não haver um caminho comum para ambiente e blast; nenhuma fórmula antiga deve ser alterada ainda.

- [ ] **Step 3: Implement the shared impulse model**

Adicionar no `WindImpulse.js`:

```js
export function createWindImpulse({ origin, direction, power, radius, falloff, verticalLift, duration, source }) {
  const normalized = direction.clone().setY(0).normalize();
  return Object.freeze({
    origin: Object.freeze(origin.clone()),
    direction: Object.freeze(normalized),
    power,
    radius,
    falloff,
    verticalLift,
    duration,
    source,
  });
}
```

Implementar a intensidade `power * falloff(distance / radius)` em um helper puro; manter `applyWindImpulse(targetObject, direction, effectivePower)` como adapter compatível até todos os consumidores migrarem.

- [ ] **Step 4: Reintroduce continuous wind before blast visuals**

Restaurar o `WindSystem` apenas se a Tarefa 0 confirmar que as remoções locais retiraram o vento contínuo. Em `Game._loop()`, preservar a ordem:

```text
wind.update(delta)
wind.samplePlayerForce(player.position, windForce)
player.setWindForce(windForce)
player.update(...)
windAbility.update(delta)
windChild.update(...)
windFX.update(delta)
lab.update(delta, player.position, wind)
```

`WindParticleSystem.triggerWindBlast` recebe o mesmo evento `source: 'blast'`; o visual não decide a força física.

- [ ] **Step 5: Add integration and disposal assertions**

Verificar que o vento ambiente soma velocidade (`+=`), o blast substitui a velocidade apenas no evento de liberação, `WindAudio.dispose()` fecha o `AudioContext` e `WindSystem.dispose()` remove poeira, streaks e áudio sem dupla liberação.

- [ ] **Step 6: Run gates and commit**

```powershell
npm test -- src/__tests__/WindField.test.js src/__tests__/WindSystem.test.js src/__tests__/WindImpulse.test.js src/__tests__/GameLifecycle.test.js
npm run lint
npm run format:check
npm run build
git add src/wind src/effects/WindParticleSystem.js src/world/TestObjectSystem.js src/world/LaboratoryBuilder.js src/main.js src/__tests__
git commit -m "refactor: unify ambient wind and blast impulses"
```

---

### Task 2: Centralizar configuração, recuperação de energia e feedback do HUD

**Files:**
- Create: `src/config/WindConfig.js`
- Modify: `src/abilities/WindAbilityConfig.js` or replace it with a compatibility re-export
- Modify: `src/abilities/WindAbilitySystem.js`
- Modify: `src/main.js`
- Modify: `src/ui/HUD.js`
- Modify: `src/style.css`, `index.html`
- Create or extend: `src/__tests__/WindAbilityConfig.test.js`, `src/__tests__/WindAbilitySystem.test.js`

**Interfaces:**
- `WindConfig` exports frozen `chargeDuration`, `cooldownDuration`, `energyCost`, `energyRecoveryRate`, `minimumEnergy`, `blastRange` and `powerThresholds`.
- `WindAbilitySystem.getState()` returns `{ state, elapsed, remaining, energy, canRelease }` without exposing mutable internals.
- `WindAbilitySystem.update(delta)` recovers energy only in `READY`/`COOLDOWN` according to `energyRecoveryRate`; charge and pause semantics remain unchanged.

- [ ] **Step 1: Add RED tests for configuration and recovery**

Assert that the same config drives charge duration, cooldown, cost, minimum energy and recovery at 30/60/120 FPS; energy never exceeds 100 or falls below `minimumEnergy`; insufficient energy blocks `start`; pause cancels charge and freezes cooldown.

- [ ] **Step 2: Run focused RED**

```powershell
npm test -- src/__tests__/WindAbilityConfig.test.js src/__tests__/WindAbilitySystem.test.js
```

- [ ] **Step 3: Implement the single config source**

Move the current three constants into `WindConfig.js`, export an alias from `WindAbilityConfig.js` for existing imports, and make `WindAbilitySystem` depend only on the normalized config object.

- [ ] **Step 4: Implement state feedback and recovery**

Advance recovery by `delta`, emit a state snapshot after release/pause/resume, and keep `Game` as the only owner of the target selection. Do not reintroduce `setTimeout` or a second timer.

- [ ] **Step 5: Expose cooldown/energy in the HUD**

Add stable IDs `#wind-energy`, `#wind-cooldown` and accessible text; update them from `getState()` without creating DOM nodes every frame. Hide cooldown text in `READY`, announce insufficient energy, and keep the current visual style.

- [ ] **Step 6: Run and commit**

```powershell
npm test -- src/__tests__/WindAbilityConfig.test.js src/__tests__/WindAbilitySystem.test.js src/__tests__/HUDDelta.test.js src/__tests__/GameLifecycle.test.js
npm run lint
npm run format:check
git add src/config src/abilities src/main.js src/ui/HUD.js src/style.css index.html src/__tests__
git commit -m "feat: centralize wind energy and cooldown configuration"
```

---

### Task 3: Replanejamento e colisão dinâmica do Wind Child

**Files:**
- Modify: `src/world/NavigationGrid.js`
- Modify: `src/entities/WindChild.js`
- Modify: `src/world/DoorSystem.js`
- Modify: `src/entities/PlayerController.js` only if it consumes the same result type
- Create or extend: `src/__tests__/NavigationGrid.test.js`, `src/__tests__/WindChild.test.js`, `src/__tests__/WindChildNavigation.test.js`

**Interfaces:**
- `NavigationGrid.findPath(startX, startZ, targetX, targetZ, { dynamicColliders = [] })` returns `{ status, reason, waypoints, requestedTarget, resolvedTarget, adjustedStart, adjustedTarget }`.
- `NavigationGrid.smoothPath(waypoints, colliders)` removes collinear points only when the segment remains clear.
- `WindChild.setNavigation(grid)` and `WindChild.moveTo(x, z)` preserve the current caller contract; `WindChild.update(delta, colliders)` cancels or requests a new route when a dynamic collider blocks the current segment.

- [ ] **Step 1: Write RED tests for dynamic blockers and smoothing**

Cover an open route, a route around a door, a door that closes after the route is created, invalid destination cleanup, no diagonal corner cutting, and a smoothed path that never crosses a collider.

- [ ] **Step 2: Run RED**

```powershell
npm test -- src/__tests__/NavigationGrid.test.js src/__tests__/WindChild.test.js src/__tests__/WindChildNavigation.test.js
```

- [ ] **Step 3: Add dynamic collider input and path smoothing**

Index dynamic colliders by occupied cells instead of scanning every collider for every cell on every query. Reuse A* buffers (`costs`, `previous`, `closed`, heap) between calls and return structured failure reasons.

- [ ] **Step 4: Recalculate or cancel on obstruction**

When `WindChild` makes no progress for `navigationBlockTimeout`, call `findPath` once with the current position and destination plus dynamic colliders. If the result is not `complete`, clear the route and set `navigationState = 'cancelled'` with the returned reason; never keep following stale waypoints.

- [ ] **Step 5: Run focused and full gates**

```powershell
npm test -- src/__tests__/NavigationGrid.test.js src/__tests__/WindChild.test.js src/__tests__/WindChildNavigation.test.js
npm test
npm run build
```

- [ ] **Step 6: Commit**

```powershell
git add src/world/NavigationGrid.js src/entities/WindChild.js src/world/DoorSystem.js src/entities/PlayerController.js src/__tests__
git commit -m "fix: replan wind child navigation around dynamic obstacles"
```

---

### Task 4: Completar a separação do LaboratoryBuilder

**Files:**
- Create: `src/world/ArchitectureBuilder.js`
- Create: `src/world/DecorationBuilder.js`
- Create: `src/world/LaboratoryScene.js`
- Modify: `src/world/LaboratoryBuilder.js`
- Modify: `src/world/DoorSystem.js`, `src/world/TestObjectSystem.js`
- Create: `src/__tests__/ArchitectureBuilder.test.js`, `src/__tests__/DecorationBuilder.test.js`, `src/__tests__/LaboratoryScene.test.js`

**Interfaces:**
- `ArchitectureBuilder.build({ root, materials, roomData })` produces floors, walls, corridors, doors and static colliders owned by its root.
- `DecorationBuilder.build({ root, materials, roomData })` produces trees, plants, benches, lights and non-colliding decoration.
- `LaboratoryScene` owns `architecture`, `doors`, `testObjects` and `decoration`; `dispose()` calls each child once and removes only the laboratory root.
- `LaboratoryBuilder` becomes composition/facade code and keeps compatibility aliases `colliders`, `doors`, `testObjects`, `rooms`, `root`, `update(delta, playerPos, windSystem)`.

- [ ] **Step 1: Write RED ownership tests**

Use two `THREE.Scene` instances and instrumented geometries/materials. Prove that disposing `LaboratoryScene` frees only laboratory resources, does not remove a Wind Child or player object, and leaves `Game` callers able to read the compatibility aliases.

- [ ] **Step 2: Extract architecture creation without changing transforms**

Move floor/wall/corridor/door/collider construction byte-for-byte into `ArchitectureBuilder`; preserve `RoomData` bounds, material assignments, positions, shadows and collider boxes.

- [ ] **Step 3: Extract decoration creation**

Move trees/plants/benches/lights/signage into `DecorationBuilder`; register each geometry/material/texture with `LaboratoryScene` ownership and keep `TextureGenerator` cache ownership separate.

- [ ] **Step 4: Make runtime systems children of `LaboratoryScene`**

Construct `DoorSystem` and `TestObjectSystem` with their owned collections; route `update(delta, playerPos, windSystem)` through `LaboratoryScene.update`. Do not let `LaboratoryBuilder` directly integrate object velocity.

- [ ] **Step 5: Run lifecycle and visual-preservation gates**

```powershell
npm test -- src/__tests__/ArchitectureBuilder.test.js src/__tests__/DecorationBuilder.test.js src/__tests__/LaboratoryScene.test.js src/__tests__/LaboratoryBuilder.test.js src/__tests__/LaboratorySystems.test.js src/__tests__/GameLifecycle.test.js
npm run build
npm run test:e2e
```

- [ ] **Step 6: Commit**

```powershell
git add src/world src/__tests__
git commit -m "refactor: split laboratory scene ownership and builders"
```

---

### Task 5: Fechar a matriz de testes unitários da Fase 3

**Files:**
- Create: `src/__tests__/WindField.test.js`
- Create: `src/__tests__/WindSystem.test.js`
- Create: `src/__tests__/WindChild.test.js`
- Extend: `src/__tests__/WindImpulse.test.js`, `src/__tests__/NavigationGrid.test.js`, `src/__tests__/RoomData.test.js`, `src/__tests__/LaboratoryBuilder.test.js`
- Modify: `vitest.config.js` only if new suites need explicit inclusion/exclusion

**Interfaces:**
- Produces deterministic tests for cache, rooms, navigation, ambient zones, wind direction, impulses, Wind Child states, cooldown, energy, collision and lifecycle.

- [ ] **Step 1: Add deterministic WindField tests**

Inject a fixed room list and deterministic random source; assert `getStrengthAt`, `sample`, zone fallback, gust transition and frame-delta invariance without relying on visual particles.

- [ ] **Step 2: Add WindSystem contract tests**

Mock `WindDustSystem`, `WindStreakSystem`, `WindAudio` and `WindField`; assert update order, `samplePlayerForce`, additive object response, audio pause/resume and idempotent disposal.

- [ ] **Step 3: Add WindChild state/lifecycle tests**

Cover `READY/CHARGING/COOLDOWN` integration, energy ownership, collision by axis, blocked route cancellation, disposal and absence of leaked callbacks.

- [ ] **Step 4: Remove nondeterminism from tests**

Use injected clocks, random sources and vectors; never assert exact random particle positions or real WebGL output in Vitest.

- [ ] **Step 5: Run the complete matrix**

```powershell
npm test
npm run lint
npm run format:check
```

Expected: every test file is listed, no suite depends on the deleted/renamed ambient-wind modules without an explicit compatibility decision.

- [ ] **Step 6: Commit**

```powershell
git add src/__tests__ vitest.config.js
git commit -m "test: complete wind and lifecycle unit coverage"
```

---

### Task 6: Expandir os smoke tests de navegador

**Files:**
- Create: `src/e2eTestBridge.js`
- Modify: `src/main.js`
- Modify: `e2e/fixtures/runtime-guard.js`
- Modify: `e2e/laboratory.smoke.spec.js`
- Create: `e2e/ability.smoke.spec.js`, `e2e/radial-menu.smoke.spec.js`
- Modify: `playwright.config.js`

**Interfaces:**
- In `import.meta.env.MODE === 'e2e'`, `window.__LABORATORY_TEST__` exposes only `getGame()`, `getWindChildCanvasPoint()` and `getAbilityState()`; production builds do not create this global.
- The bridge is disposed with `Game.destroy()` and throws no error when absent.

- [ ] **Step 1: Add the bridge test in Vitest**

Assert that production mode does not expose the bridge, E2E mode returns the current game, and destroy removes the global.

- [ ] **Step 2: Add RED browser scenarios**

Add scenarios for initial screen, start, HUD, floor movement, `M` map open, `Escape` close, right-click floor negative case, right-click Wind Child positive case, keyboard sector navigation, charge start, cooldown block, pause charge cancellation and console/runtime errors.

- [ ] **Step 3: Implement stable selectors and bridge-only diagnostics**

Use roles/IDs for DOM controls; use the bridge only to calculate the real projected Wind Child point and read ability state. Do not add coordinate-based production behavior or bypass the real raycast.

- [ ] **Step 4: Run the browser matrix**

```powershell
npm run test:e2e
npx playwright test e2e/radial-menu.smoke.spec.js --project=chromium
npx playwright test e2e/ability.smoke.spec.js --project=chromium
```

Expected: no `pageerror`, no unexpected `console.error`, no failed local request, WebGL context/drawing buffer valid and `gl.getError() === gl.NO_ERROR`.

- [ ] **Step 5: Commit**

```powershell
git add src/e2eTestBridge.js src/main.js e2e playwright.config.js
git commit -m "test: cover laboratory interaction smoke flows"
```

---

### Task 7: Revalidar CI, documentação e artefatos de entrega

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `docs/FASE-1-2-REGISTRO.md`
- Modify: `.gitignore`, `.gitattributes`, `package.json`, `package-lock.json`, `.nvmrc` only when the audit finds drift

**Interfaces:**
- CI runs with Node 24, `npm ci`, lint, format check, unit tests, production build, Chromium install and E2E.
- README documents current controls, ability states, ambient wind, impulse model, architecture, scripts, Node 24 and known limitations.

- [ ] **Step 1: Validate reproducible install**

```powershell
npm ci --ignore-scripts
node --version
```

Expected: Node major is 24 and lockfile is accepted without modifying tracked dependency metadata.

- [ ] **Step 2: Update README from the actual code**

Document `WindField` versus `WindImpulse`, `WindAbilitySystem` states, `RoomData`, controls, E2E bridge restriction, adaptive quality plan and the intentionally incremental builder extraction.

- [ ] **Step 3: Validate workflow locally where possible**

Run the exact commands from `.github/workflows/ci.yml` in order and inspect that the E2E build uses `--mode e2e` while the production build keeps `drop_console`.

- [ ] **Step 4: Commit documentation/CI only**

```powershell
git add .github README.md docs .gitignore .gitattributes package.json package-lock.json .nvmrc
git commit -m "chore: align Node 24 CI and project documentation"
```

---

### Task 8: Criar baseline mensurável antes da Fase 4

**Files:**
- Create: `scripts/perf-baseline.js`
- Create: `src/__tests__/PerformanceBaseline.test.js`
- Modify: `README.md`, `docs/FASE-1-2-REGISTRO.md`

**Interfaces:**
- `collectPerformanceSample({ durationMs, frameSource })` returns `{ fps, frameTimeP95, cpuMsP95, allocations, startupMs, objectCount, drawCalls }`.
- The baseline records machine-independent workload parameters and does not claim a gain without before/after values.

- [ ] **Step 1: Define one reproducible workload**

Use a fixed 10-second run after laboratory startup: player idle in Confirmed 42, ambient wind enabled, 3 blast impulses at known times, TacMap closed, profiler disabled. Record viewport, DPR, browser, Node and WebGL renderer.

- [ ] **Step 2: Write RED validation tests**

Assert percentile calculation, empty sample handling and stable serialization to `docs/perf-baseline.json` without requiring a real browser in Vitest.

- [ ] **Step 3: Implement the collector**

Use `performance.now()` and existing `PerformanceProfiler` counters; keep the collector opt-in and outside production runtime.

- [ ] **Step 4: Run and archive the baseline**

```powershell
node scripts/perf-baseline.js --duration=10000 --output=docs/perf-baseline.json
npm test -- src/__tests__/PerformanceBaseline.test.js
```

- [ ] **Step 5: Commit**

```powershell
git add scripts src/__tests__/PerformanceBaseline.test.js docs/perf-baseline.json docs/FASE-1-2-REGISTRO.md
git commit -m "perf: add reproducible laboratory baseline"
```

---

### Task 9: Qualidade gráfica adaptativa e profiler somente em desenvolvimento

**Files:**
- Create: `src/engine/QualitySettings.js`
- Create: `src/engine/QualityManager.js`
- Modify: `src/engine/Renderer.js`
- Modify: `src/effects/WindParticleSystem.js`
- Modify: `src/engine/PerformanceProfiler.js`
- Modify: `src/main.js`
- Create: `src/__tests__/QualityManager.test.js`, `src/__tests__/PerformanceProfiler.test.js`

**Interfaces:**
- `QualitySettings` exports frozen `LOW`, `MEDIUM`, `HIGH`, `ULTRA` with pixel ratio, shadow map size, particle counts, dynamic lights, effect distance and profiler frequency.
- `QualityManager.sample({ fps, frameTimeP95, gpuMsP95 })` returns a level only after the configured warmup window; `apply(renderer, particles)` changes settings without recreating the game.
- `PerformanceProfiler` is instantiated only when `import.meta.env.DEV` or `?debug` is present and `dispose()` closes its DOM panel/listeners.

- [ ] **Step 1: Write RED tests for hysteresis and dev gating**

Assert no quality switch before warmup, downgrade after sustained low FPS, upgrade only after sustained recovery, no oscillation at the threshold, profiler hidden by default in production and query-string activation in development.

- [ ] **Step 2: Implement immutable settings and manager**

Apply pixel ratio, shadows, dust, streaks, blast particles, smoke, dynamic lights and profiler frequency through one manager; keep `HIGH` as the current visual baseline.

- [ ] **Step 3: Make profiler lazy**

Construct it conditionally in `Game`; replace fixed hardware text with measured CPU/GPU timing labels and update the panel at the configured low frequency.

- [ ] **Step 4: Run focused and baseline comparison**

```powershell
npm test -- src/__tests__/QualityManager.test.js src/__tests__/PerformanceProfiler.test.js
npm run build
npm run test:e2e
```

- [ ] **Step 5: Commit**

```powershell
git add src/engine src/effects/WindParticleSystem.js src/main.js src/__tests__
git commit -m "perf: add adaptive quality and dev profiler"
```

---

### Task 10: Otimizar sombras, renderização e geração do mapa com evidência

**Files:**
- Modify: `src/engine/Renderer.js`
- Modify: `src/world/NavigationGrid.js`
- Modify: `src/world/LaboratoryBuilder.js`, `src/world/ArchitectureBuilder.js`
- Modify: `src/world/TextureGenerator.js`
- Create: `src/__tests__/NavigationPerformance.test.js`
- Modify: `scripts/perf-baseline.js`

**Interfaces:**
- Renderer applies quality settings to pixel ratio, shadows, antialias and dynamic lights.
- `NavigationGrid` reuses spatial indexes and A* buffers; `build()` reports elapsed milliseconds and cell/collider counts.
- Static laboratory geometry/materials are reused or batched only when the baseline demonstrates a bottleneck.

- [ ] **Step 1: Add instrumentation before optimization**

Measure startup, navigation build, path query, draw calls, shadow map time and memory-sensitive object counts for the fixed workload.

- [ ] **Step 2: Write RED regression thresholds from the baseline**

Use relative thresholds, not arbitrary machine-specific FPS promises: path-query allocations must not increase, startup p95 must not regress by more than 10%, and visual object counts must match the selected quality level.

- [ ] **Step 3: Implement spatial navigation reuse**

Replace per-query allocations with reusable typed arrays/heaps and keep a collider-cell index; preserve `findPath()` statuses and waypoint results.

- [ ] **Step 4: Implement measured renderer reductions**

Disable small-object shadows, cap dynamic lights, choose antialias/pixel ratio by `QualityManager`, and do not add post-processing without a measured visual benefit.

- [ ] **Step 5: Compare before/after and commit only if gates improve**

```powershell
node scripts/perf-baseline.js --duration=10000 --output=docs/perf-baseline-after.json
npm test -- src/__tests__/NavigationPerformance.test.js
npm run build
npm run test:e2e
git add src/engine src/world src/__tests__ scripts docs/perf-baseline-after.json
git commit -m "perf: optimize measured navigation and rendering paths"
```

If the measured result is neutral or regresses, keep the instrumentation and revert only the optimization commit; do not claim a speedup.

---

### Task 11: TacMap responsivo e suporte a telas pequenas

**Files:**
- Modify: `src/ui/TacMap.js`
- Modify: `src/style.css`
- Modify: `index.html`
- Modify: `src/main.js`
- Create: `src/ui/TouchControls.js`
- Create: `src/__tests__/TouchControls.test.js`, `e2e/responsive.smoke.spec.js`

**Interfaces:**
- `TacMap.resize({ width, height, devicePixelRatio })` recalculates canvas dimensions and scale from its container.
- `TouchControls` emits `move`, `map`, `radial`, `zoom` and `pause` actions and has `dispose()`.
- `Game` ignores touch controls when pointer-lock desktop input is active and never registers duplicate listeners.

- [ ] **Step 1: Write RED viewport and touch tests**

Cover 320×568, 768×1024 and desktop viewport; assert no horizontal overflow, map sidebar stacks vertically, safe-area padding is present, and touch actions call the same command handlers as keyboard/mouse.

- [ ] **Step 2: Implement relative TacMap sizing**

Use `ResizeObserver` with a stored callback, DPR-aware backing canvas size, CSS grid/flex breakpoints and `env(safe-area-inset-*)`; dispose the observer and RAF together.

- [ ] **Step 3: Implement touch controls and graceful fallback**

Add virtual movement/menu/map buttons, WebGL unavailable message and audio unavailable message. Do not duplicate gameplay logic; route controls into `InputManager`/`Game` commands.

- [ ] **Step 4: Run responsive browser gates**

```powershell
npx playwright test e2e/responsive.smoke.spec.js --project=chromium
npm test -- src/__tests__/TouchControls.test.js
npm run test:e2e
```

- [ ] **Step 5: Commit**

```powershell
git add src/ui src/style.css src/main.js index.html e2e src/__tests__
git commit -m "feat: add responsive map and touch controls"
```

---

### Task 12: Lifecycle, áudio e artefatos finais

**Files:**
- Modify: `src/main.js`, `src/engine/InputManager.js`, `src/engine/Renderer.js`, `src/ui/TacMap.js`, `src/ui/RadialMenu.js`, `src/ui/HUD.js`, `src/effects/WindParticleSystem.js`, `src/wind/WindAudio.js`
- Create or extend: `src/__tests__/LifecycleIntegration.test.js`
- Modify: `e2e/runtime-guard.spec.js`

**Interfaces:**
- A create/destroy/recreate cycle leaves no RAF, timer, window/canvas listener, DOM overlay, Three.js root, particle resource or open `AudioContext`.

- [ ] **Step 1: Write lifecycle RED tests**

Instrument RAF, `setTimeout`, resize/contextmenu/keydown listeners, DOM nodes, Three.js dispose calls and `AudioContext.close`; execute `new Game(); destroy(); new Game(); destroy()` twice.

- [ ] **Step 2: Implement missing guards and ownership cleanup**

Use stable handler references, idempotent flags, stored RAF IDs and explicit `AudioContext.close()`; ensure `destroy()` stops future scheduling before disposing children.

- [ ] **Step 3: Run lifecycle gates**

```powershell
npm test -- src/__tests__/LifecycleIntegration.test.js src/__tests__/GameLifecycle.test.js src/__tests__/TacMap.test.js
npm run build
npm run test:e2e
```

- [ ] **Step 4: Commit**

```powershell
git add src e2e
git commit -m "test: verify complete laboratory lifecycle cleanup"
```

---

### Task 13: Gate de release e encerramento do plano

**Files:**
- Modify: `docs/FASE-1-2-REGISTRO.md`
- Modify: `README.md` only when the final architecture or controls changed

**Interfaces:**
- Produces a release checklist with commands, commit hashes, measured baseline comparison, known limitations and a clean branch.

- [ ] **Step 1: Execute the full command matrix on Node 24**

```powershell
node --version
npm ci
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected: Node major 24, all commands exit 0, `git status --short` is empty and no `dist/`, `test-results/`, `playwright-report/` or `.vite/` artifact is tracked.

- [ ] **Step 2: Verify the original smoke flow manually**

Start the laboratory, move the player, open TacMap, open the radial menu on the real Wind Child, execute one blast, pause during charge, resume, destroy and recreate the game. Record the observed result and browser console state.

- [ ] **Step 3: Review every requirement against this plan**

Mark each Phase 2, Phase 3 and Phase 4 requirement as `done`, `deferred with reason` or `not applicable`; unresolved items must name the exact file and next test rather than a generic marker.

- [ ] **Step 4: Commit the final record**

```powershell
git add docs/FASE-1-2-REGISTRO.md README.md
git commit -m "docs: close remaining phase gates"
```

## Self-review and coverage matrix

| Requirement still missing | Task |
|---|---|
| Reconcile uncommitted wind rewrite and preserve ambient wind | 0-1 |
| Full shared impulse model and ambient/blast coordination | 1 |
| Central `WindConfig`, energy recovery, minimum energy and HUD cooldown | 2 |
| Dynamic doors, route invalidation, smoothing and reusable navigation buffers | 3 |
| Architecture/decoration/laboratory scene ownership split | 4 |
| Missing `WindField`, `WindSystem`, `WindChild` and lifecycle unit coverage | 5, 12 |
| Movement/map/radial/ability/pause console smoke coverage | 6 |
| Node 24 CI/docs/install consistency | 7, 13 |
| Measured performance baseline | 8 |
| Adaptive quality and development-only profiler | 9 |
| Measured render/navigation optimization | 10 |
| Responsive TacMap, touch controls and WebGL/audio fallback | 11 |

No task uses a placeholder, “implementar depois” or an unspecified test. Every new public method has a named consumer, return shape and focused test. The only intentional deferral is visual architecture extraction when a byte-for-byte move would change the validated scene; that deferral must be recorded with evidence in the registry rather than silently omitted.
