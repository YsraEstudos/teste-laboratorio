# Sistema de Areia Realista e Performante — Plano de Implementação

> Para agentes de implementação: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Cada etapa usa checkboxes para acompanhamento.

**Objetivo:** substituir o sistema atual de areia por uma implementação visualmente convincente, com deformação e efeitos de contato, sem travar o renderer quando a câmera entra na arena.

**Arquitetura:** separar a areia em quatro responsabilidades: perfil de qualidade, malha/material estático, campo de deformação e efeitos transitórios. A malha carregará mapas PBR compartilhados e baratos; a deformação usará um campo R8 pequeno e atualizações coalescidas; partículas/GPGPU ficarão condicionais e só serão ativadas depois de uma medição. Um único componente será dono do rastreamento de pegadas.

**Referência técnica adotada:** o `Noniv/snowflow_demo` mantém uma deformação persistente e aditiva, recebe pés, wakes e efeitos por uma única operação `brush()`, atualiza um estado ping-pong sem readback por frame e usa a mesma altura para renderização e grounding. Neste projeto Three.js, a implementação equivalente será: WebGL2 em alta qualidade com dois render targets RGBA16F e um pass de simulação; fallback WebGL/R8 coalescido em média/baixa; brush staging pré-alocado; canais de depressão, berm e compactação; e um sampler CPU derivado/atualizado somente para colisões. A inspiração é arquitetural, não uma cópia de código.

**Stack:** Three.js 0.185, WebGL 2/WebGL 1 fallback, Vite, Vitest, Playwright E2E, CanvasTexture/DataTexture, InstancedMesh e GLSL de MeshStandardMaterial.

## Restrições globais

- Não reintroduzir EffectComposer, bloom ou outro pós-processamento sem comparação de frame time e cobertura visual.
- Coletar baseline antes da primeira otimização e repetir com o mesmo viewport, DPR, navegador e GPU.
- A meta obrigatória é estabilidade a 60 FPS e ausência de contextLost; 120 FPS é meta opcional.
- A contribuição da areia deve ficar em até 1 draw call de terreno e 8.192 triângulos na alta. O fallback R8 deve ficar em 65.536 bytes; o modo WebGL2 de altíssima qualidade pode usar dois RGBA16F de 256² somente se o baseline comprovar estabilidade e o orçamento de memória for reportado separadamente.
- A alta usará mapas PBR de 256², salvo evidência de que resolução maior melhora a imagem sem romper o orçamento.
- O GPGPU não será ativado por padrão enquanto não houver medição isolada.
- Recursos criados pelo terreno terão proprietário explícito e serão liberados no dispose().
- Manter getElevationAt(), colisões, limites da arena e lifecycle idempotente.
- Não modificar arquivos não relacionados; cada commit listará arquivos explicitamente.

## Diagnóstico consolidado

- SandTerrainSystem.js:16 cria PlaneGeometry 128×128: 16.641 vértices e 32.768 triângulos. A malha entra no frame quando a câmera chega à arena.
- SandTerrainSystem.js:54-62 cria albedo/roughness 512² e normal 1024²; o shader em :79-140 adiciona amostras de deformação, hash31, floor, normalize, dot e pow por fragmento.
- TextureGenerator.js:538-620 gera mapas sincronamente. O normal de 1024² executa 40.000 fillRect com Box-Muller em :581-597; roughness executa mais 8.000 marcas.
- LaboratoryBuilder.js:98-106 cria outro conjunto de mapas avançados, mas não há consumidor de materials.sand; o terreno cria o próprio conjunto.
- SandTerrainSystem.js:232-260 usa Canvas 512², gradiente radial e needsUpdate da textura inteira a cada pegada. :268-280 repinta 512² aleatoriamente em aproximadamente 10% dos frames.
- TestObjectSystem.js:85-92 pode chamar addFootprint() a cada frame enquanto objeto pesado se move no chão.
- SandTerrainSystem.js:298-300 libera depthTexture, mas não libera material.map, normalMap e roughnessMap; recriar o jogo pode acumular texturas GPU.
- LaboratoryBuilder.js:31-32 passa apenas scene para GPUComputeSandSystem, embora o construtor espere renderer e scene. O GPGPU está headless hoje, mas o caminho latente reserva 262.144 partículas.
- main.js:49, :332 e :333 não conectam corretamente SandVFXSystem ao VFXManager nem passam posições; os efeitos pretendidos estão inativos ou parcialmente integrados.
- PerformanceProfiler.js:557-563 chama de GPU o tempo de retorno de renderer.render(); isso mede submissão/bloqueio do JS, não o tempo real do GPU.
- A deformação visual em SandTerrainSystem.js:103-108 afunda vértices, mas as normais só são calculadas uma vez em :165; a iluminação não acompanha a pegada.
- TestObjectSystem.js usa getElevationAt() sem consultar o campo de deformação; a física fica na altura original enquanto a imagem mostra uma depressão.
- addFootprint() converte o raio usando somente a largura X; como a arena tem 24 m em X e 18 m em Z, a pegada fica aproximadamente 25% comprimida em Z.
- uTime é atualizado mas não participa do GLSL; o brilho é aplicado depois do dithering/tonemapping do material e pode estourar de forma artificial.
- GroundDustSystem percorre 120 partículas em todo frame e nunca recebe o evento de blast; SandVFXSystem cria sistemas transitórios por pegada/blast quando for conectado.
- A reprodução controlada mais recente carregou e ficou estável após entrar no laboratório, com apenas avisos de depreciação. O percurso próximo à areia ainda precisa ser instrumentado antes de afirmar uma causa única.

## Orçamento de aceite

| Área | Alta | Média | Baixa |
|---|---:|---:|---:|
| Segmentos | 64×64 | 48×48 | 32×32 |
| Triângulos | 8.192 | 4.608 | 2.048 |
| Mapas PBR | 256² | 256² | albedo 128², sem normal |
| Deformação | R8 256² = 64 KiB | R8 192² | R8 128² |
| GPGPU | desligado | desligado | desligado |
| VFX de contato | 4 emissores reutilizados | 2 | 0 |
| Sombra recebida | opcional e medida | desligada | desligada |

Aceitar somente se o contexto WebGL não for perdido, não houver exceções não tratadas, não houver crescimento contínuo de renderer.info.memory.textures em cinco minutos, o p95 próximo da areia for menor ou igual a 16,7 ms em 1920×1080/DPR 1 e o percurso de entrada não piorar mais de 10% contra o baseline.

---

### Tarefa 1: Criar baseline reproduzível antes de mudar o terreno

**Arquivos:**
- Criar: scripts/sand-performance-baseline.mjs
- Criar: e2e/sand.performance.spec.js
- Criar: src/__tests__/SandPerformance.test.js
- Criar: src/engine/PerformanceStats.js
- Criar: docs/sand-performance-before.json
- Modificar: src/main.js:28-100
- Modificar: src/world/SandTerrainSystem.js:1-20

**Interfaces:**
- SandTerrainSystem.getDebugStats() retorna { quality, vertices, triangles, textureResolution, deformationBytes, footprintCount, lastUploadAt }.
- Em desenvolvimento, window.__LAB_DEBUG__ contém { game, renderer, sand } e é removido em Game.destroy().
- collectSandSample({ game, frames }) retorna { frameTimeP50, frameTimeP95, frameTimeP99, drawCalls, triangles, textures, geometries, contextLost }.
- percentile(values, quantile) é uma função pura exportada por src/engine/PerformanceStats.js e reutilizada pelo coletor, pelos testes e pelo relatório do baseline.

- [ ] Passo 1: Escrever testes vermelhos de métricas.

~~~js
it('calcula p95 sem ordenar o array original', () => {
  const values = [8, 10, 12, 20, 40];
  expect(percentile(values, 0.95)).toBe(40);
  expect(values).toEqual([8, 10, 12, 20, 40]);
});

it('relata o orçamento atual da areia', () => {
  const stats = new SandTerrainSystem(new THREE.Scene()).getDebugStats();
  expect(stats.triangles).toBe(32768);
  expect(stats.deformationBytes).toBe(512 * 512 * 4);
});
~~~

- [ ] Passo 2: Confirmar o RED.

~~~powershell
npm test -- src/__tests__/SandPerformance.test.js
~~~

Esperado: falha por coletor/debug ainda ausentes.

- [ ] Passo 3: Adicionar hook somente de desenvolvimento.

Depois de this.lab existir no construtor de Game:

~~~js
if (import.meta.env.DEV) {
  window.__LAB_DEBUG__ = {
    game: this,
    renderer: this.renderer,
    sand: this.lab.sandTerrainSystem,
  };
}
~~~

O coletor deve posicionar o jogador em z = 4.5, z = -40 e z = -55, esperar 120 frames em cada estado e coletar frame time, renderer.info e gl.isContextLost(). Não usar o campo gpuTimeMs atual como GPU real.

- [ ] Passo 4: Criar E2E de entrada e aproximação.

Abrir /, clicar uma vez em ENTRAR NO LABORATÓRIO, coletar estado distante e estado próximo. Falhar em contextLost, console error, crescimento de texturas ou p95 acima de 16,7 ms no baseline de referência.

- [ ] Passo 5: Arquivar o baseline.

~~~powershell
npm test -- src/__tests__/SandPerformance.test.js
npm run test:e2e -- e2e/sand.performance.spec.js
node scripts/sand-performance-baseline.mjs --duration=10000 --output=docs/sand-performance-before.json
~~~

Salvar viewport, DPR, navegador, renderer WebGL, qualidade, draws, triângulos, p50/p95/p99 e contagem de texturas.

- [ ] Passo 6: Commitar somente o baseline.

~~~powershell
git add scripts/sand-performance-baseline.mjs e2e/sand.performance.spec.js src/__tests__/SandPerformance.test.js src/engine/PerformanceStats.js src/main.js src/world/SandTerrainSystem.js docs/sand-performance-before.json
git commit -m "test: add measurable sand performance baseline"
~~~

---

### Tarefa 2: Definir perfis de qualidade e remover recursos duplicados

**Arquivos:**
- Criar: src/world/SandQualityProfile.js
- Modificar: src/world/TextureGenerator.js:3-52,538-623
- Modificar: src/world/LaboratoryBuilder.js:90-110
- Modificar: src/world/SandTerrainSystem.js:12-70
- Criar: src/__tests__/SandQualityProfile.test.js
- Modificar: src/__tests__/TextureGenerator.test.js

**Interfaces:**
- getSandQuality(name = 'high') retorna configuração congelada com segments, mapResolution, deformationResolution, anisotropy, sparkles, receiveShadow, footstepVfx, gpuParticles e maxContactEmitters.
- TextureGenerator.acquireSandTextureSet({ quality }) retorna { key, albedo, normal, roughness, release() } com referência compartilhada.
- SandTerrainSystem recebe constructor(scene, { quality = 'high', textureSet = null } = {}) e libera a referência no dispose().

- [ ] Passo 1: Escrever testes vermelhos de perfil e compartilhamento.

~~~js
it('expõe orçamento geométrico monotônico', () => {
  expect(getSandQuality('high').segments).toBe(64);
  expect(getSandQuality('medium').segments).toBe(48);
  expect(getSandQuality('low').segments).toBe(32);
  expect(getSandQuality('high').deformationResolution).toBe(256);
});

it('compartilha mapas e libera após o último consumidor', () => {
  const first = TextureGenerator.acquireSandTextureSet({ quality: 'high' });
  const second = TextureGenerator.acquireSandTextureSet({ quality: 'high' });
  expect(second.albedo).toBe(first.albedo);
  const dispose = vi.spyOn(first.albedo, 'dispose');
  first.release();
  expect(dispose).not.toHaveBeenCalled();
  second.release();
  expect(dispose).toHaveBeenCalledOnce();
});
~~~

- [ ] Passo 2: Implementar perfis imutáveis.

~~~js
const PROFILES = {
  low: Object.freeze({ segments: 32, mapResolution: 128, deformationResolution: 128, anisotropy: 1, sparkles: false, receiveShadow: false, footstepVfx: false, gpuParticles: false, maxContactEmitters: 0 }),
  medium: Object.freeze({ segments: 48, mapResolution: 256, deformationResolution: 192, anisotropy: 2, sparkles: false, receiveShadow: false, footstepVfx: true, gpuParticles: false, maxContactEmitters: 2 }),
  high: Object.freeze({ segments: 64, mapResolution: 256, deformationResolution: 256, anisotropy: 2, sparkles: true, receiveShadow: true, footstepVfx: true, gpuParticles: false, maxContactEmitters: 4 }),
};
export function getSandQuality(name = 'high') {
  return PROFILES[name] || PROFILES.high;
}
~~~

- [ ] Passo 3: Implementar cache com referência.

Gerar cada mapa por chave de qualidade, compartilhar o mesmo CanvasTexture e manter refs. release() chama dispose() nos três mapas somente quando refs === 0. Albedo fica em sRGB; normal e roughness em NoColorSpace; anisotropia fica limitada ao perfil.

- [ ] Passo 4: Remover mapas não usados do builder.

Eliminar as três chamadas advanced sand de LaboratoryBuilder._createMaterials(). O builder não deve criar materials.sand sem consumidor; a posse fica somente com SandTerrainSystem.

- [ ] Passo 5: Validar duplicação e memória.

~~~powershell
npm test -- src/__tests__/SandQualityProfile.test.js src/__tests__/TextureGenerator.test.js src/__tests__/LaboratoryBuilder.test.js
npm run test:e2e -- e2e/sand.performance.spec.js
~~~

Confirmar um único conjunto PBR e nenhuma subida após destruir/recriar Game.

- [ ] Passo 6: Commitar.

~~~powershell
git add src/world/SandQualityProfile.js src/world/TextureGenerator.js src/world/LaboratoryBuilder.js src/world/SandTerrainSystem.js src/__tests__
git commit -m "perf: share sand texture sets by quality"
~~~

---

### Tarefa 3: Substituir Canvas 512² por campo persistente inspirado no Snowflow

**Arquivos:**
- Criar: src/world/SandDeformationField.js
- Criar: src/__tests__/SandDeformationField.test.js
- Modificar: src/world/SandTerrainSystem.js:20-50,232-280
- Modificar: src/world/TestObjectSystem.js:34-110
- Modificar: src/world/LaboratoryBuilder.js:1243-1275
- Modificar: src/engine/Renderer.js:1-80
- Modificar: src/main.js:40-55
- Criar: src/world/SandDeformationSimulation.js
- Criar: src/__tests__/SandDeformationSimulation.test.js

**Interfaces:**
- new SandDeformationField({ width, height, minX, maxX, minZ, maxZ, decayPerSecond, maxDepth, renderer, scene }) escolhe `gpuPingPong` somente em WebGL2 suportado e mantém fallback CPU R8.
- field.brush(x, z, radius, depth, berm, compression, yaw, elongation, edge) escreve em staging pré-alocado; field.stamp(...) permanece como alias compatível para contatos simples.
- field.advance(delta) decai em passos de no máximo 1/15 s, sem Math.random() e sem alocações.
- field.consumeDirty() retorna true uma vez por lote.
- O backend CPU expõe THREE.DataTexture R8; o backend WebGL2 expõe a textura RGBA16F ping-pong e executa um único pass que relaxa, espalha berm, aplica vento e splats.
- field.sampleWorld(x, z) retorna { depth, berm, compression } da cópia CPU disponível para física; nenhum código de colisão reimplementa a função procedural do shader.

- [ ] Passo 1: Escrever testes vermelhos.

~~~js
it('ignora fora dos limites e limita profundidade', () => {
  const field = new SandDeformationField({ width: 8, height: 8, minX: -4, maxX: 4, minZ: -4, maxZ: 4, maxDepth: 0.2 });
  field.stamp(100, 100, 1, 1);
  expect(field.data.every((value) => value === 0)).toBe(true);
  field.stamp(0, 0, 2, 1);
  expect(Math.max(...field.data)).toBe(255);
});

it('coalesce stamps e decai no intervalo agendado', () => {
  const field = new SandDeformationField({ width: 8, height: 8, minX: -4, maxX: 4, minZ: -4, maxZ: 4, decayPerSecond: 0.1 });
  field.stamp(0, 0, 1, 0.1);
  field.stamp(0, 0, 1, 0.1);
  const peak = Math.max(...field.data);
  expect(field.consumeDirty()).toBe(true);
  expect(field.consumeDirty()).toBe(false);
  field.advance(1 / 60);
  expect(Math.max(...field.data)).toBe(peak);
  field.advance(1 / 15);
  expect(Math.max(...field.data)).toBeLessThan(peak);
});

it('mantém depression, berm e compression no mesmo brush', () => {
  const field = new SandDeformationField({ width: 32, height: 32, minX: -4, maxX: 4, minZ: -4, maxZ: 4, maxDepth: 0.2 });
  field.brush(0, 0, 0.4, 0.12, 0.03, 0.8, Math.PI / 4, 1.6, 0.2);
  const sample = field.sampleWorld(0, 0);
  expect(sample.depth).toBeGreaterThan(0);
  expect(sample.compression).toBeGreaterThan(0);
});
~~~

- [ ] Passo 2: Implementar brush staging compartilhado.

Prealocar até 96 brushes por frame, com x/z/radius/elongation, yaw, depth/berm e compression/edge. Rejeitar brushes fora da janela; escrever somente números no typed array. Não criar CanvasGradient, strings rgba, objetos Three ou arrays por contato.

- [ ] Passo 3: Integrar DataTexture R8.

Remover depthCanvas, depthCtx e createRadialGradient. Criar DataTexture com filtro linear, ClampToEdgeWrapping e sem mipmaps. Marcar needsUpdate apenas quando consumeDirty() for verdadeiro. Em 256², o upload máximo fica em 64 KiB contra aproximadamente 1 MiB do Canvas RGBA 512².

- [ ] Passo 4: Implementar backend WebGL2 ping-pong para alta qualidade.

Criar dois WebGLRenderTarget RGBA16F 256², sem mipmaps, e um pass fullscreen com canais depth/berm/compression/ice. O pass deve aplicar todos os brushes, relaxamento exponencial, slump da berm para a depressão e infill orientado pelo vento; trocar os targets sem readback. Limitar a atualização ao intervalo em que a câmera/player está na arena e aquecer os targets atrás do loading screen.

- [ ] Passo 5: Throttlar contatos físicos.

Em TestObjectSystem, manter lastFootprintAt e lastFootprintPosition por objeto. Só chamar addFootprint() após 0,35 m ou 120 ms. Em LaboratoryBuilder, coalescer player e Wind Child no mesmo lote antes de atualizar a textura.

- [ ] Passo 6: Manter visual e física na mesma altura.

Adicionar sampleWorld(x, z) ao SandDeformationField e fazer TestObjectSystem usar getElevationAt(x, z) menos a profundidade do campo, com o mesmo clamp usado no shader. Corrigir a conversão do stamp para usar raioX = radius / (maxX - minX) e raioZ = radius / (maxZ - minZ), preservando uma pegada circular em metros. Na alta, derivar uma normal aproximada do campo com quatro amostras vizinhas; na média/baixa, manter a normal estática e usar apenas o escurecimento do imprint.

- [ ] Passo 7: Validar.

~~~powershell
npm test -- src/__tests__/SandDeformationField.test.js src/__tests__/LaboratorySystems.test.js src/__tests__/LaboratoryBuilder.test.js
npm run lint
npm run test:e2e -- e2e/sand.performance.spec.js
~~~

O E2E deve confirmar stamps limitados durante caminhada contínua, dispose único do campo e que a altura física de um objeto acompanha a amostra deformada dentro da tolerância de 1 cm.

- [ ] Passo 8: Commitar.

~~~powershell
git add src/world/SandDeformationField.js src/world/SandDeformationSimulation.js src/world/SandTerrainSystem.js src/world/TestObjectSystem.js src/world/LaboratoryBuilder.js src/engine/Renderer.js src/main.js src/__tests__/SandDeformationField.test.js src/__tests__/SandDeformationSimulation.test.js
git commit -m "perf: replace canvas sand deformation with compact field"
~~~

---

### Tarefa 4: Reduzir shader, geometria e custo de textura sem perder realismo

**Arquivos:**
- Modificar: src/world/SandTerrainSystem.js:16-180
- Modificar: src/world/TextureGenerator.js:538-620
- Criar: src/__tests__/SandTerrainSystem.test.js

**Interfaces:**
- getDebugStats() reporta vertices, triangles, shaderFeatures e textureResolution.
- setQuality(profile) troca somente configurações permitidas.
- getElevationAt(x, z) mantém o contrato atual.

- [ ] Passo 1: Escrever testes vermelhos de malha e ownership.

~~~js
it('usa o orçamento geométrico da alta', () => {
  const terrain = new SandTerrainSystem(new THREE.Scene(), { quality: 'high' });
  expect(terrain.getDebugStats().triangles).toBe(8192);
  expect(terrain.mesh.castShadow).toBe(false);
});

it('libera os mapas PBR do terreno', () => {
  const terrain = new SandTerrainSystem(new THREE.Scene(), { quality: 'medium' });
  const dispose = vi.spyOn(terrain.material.map, 'dispose');
  terrain.dispose();
  expect(dispose).toHaveBeenCalledOnce();
});
~~~

- [ ] Passo 2: Reduzir malha e separar escala macro/micro.

Usar PlaneGeometry(24, 18, profile.segments, profile.segments). Manter macro-dunas na elevação dos vértices e representar ripples/microgrãos nos mapas; não usar 128² vértices para detalhes que pertencem ao material.

- [ ] Passo 3: Remover trabalho redundante por fragmento.

Manter uma amostra de deformação no vertex shader para deslocamento e, apenas na alta, uma segunda amostra para escurecer a impressão. Remover hash31, floor(viewDir * 12.0), pow e brilho aleatório do fragmento. Substituir por detalhe normal/roughness estático e uma intensidade uniforme. Quando sparkles for falso, não declarar nem atualizar uTime.

- [ ] Passo 4: Gerar mapas menores e determinísticos.

Trocar normal 1024² por 256². Substituir 40.000 fillRect aleatórios por grade determinística de 2.048 a 4.096 marcas; roughness fica em 1.024 a 2.048 marcas. Manter albedo em sRGB e normal/roughness em NoColorSpace. Remover `createSandTexture()` se a implementação continuar sem consumidor.

- [ ] Passo 5: Ajustar sombras.

Definir mesh.castShadow = false sempre. Deixar receiveShadow somente na alta e medir; média/baixa ficam sem sombra dinâmica. Não aumentar shadow map para compensar a areia. A sombra da lanterna deve ser aplicada somente quando ligada e seguir a qualidade global. Mover o brilho customizado para antes do tonemapping ou substituí-lo por uma contribuição normal/roughness; nunca adicionar RGB depois do dithering.

- [ ] Passo 6: Validar aparência e custo.

~~~powershell
npm test -- src/__tests__/SandTerrainSystem.test.js src/__tests__/TextureGenerator.test.js
npm run build
npm run test:e2e -- e2e/sand.performance.spec.js
node scripts/sand-performance-baseline.mjs --duration=10000 --output=docs/sand-performance-after-shader.json
~~~

Aceitar somente se o p95 melhorar contra docs/sand-performance-before.json, as macro-dunas/ripples continuarem visíveis e não surgir contextLost.

- [ ] Passo 7: Commitar.

~~~powershell
git add src/world/SandTerrainSystem.js src/world/TextureGenerator.js src/__tests__ docs/sand-performance-after-shader.json
git commit -m "perf: reduce sand geometry and fragment shader cost"
~~~

---

### Tarefa 5: Corrigir contrato de interação e reutilizar VFX

**Arquivos:**
- Modificar: src/main.js:44-50,295-333
- Modificar: src/world/LaboratoryBuilder.js:1243-1275
- Modificar: src/effects/SandVFXSystem.js:24-274
- Modificar: src/effects/VFXManager.js:1-170
- Modificar: src/effects/GroundDustSystem.js:1-120
- Modificar: src/wind/WindParticleSystem.js:1-220
- Criar: src/__tests__/SandVFXSystem.test.js
- Criar: src/__tests__/helpers/gameHarness.js

**Interfaces:**
- new SandVFXSystem(scene, vfxManager, { quality }).
- SandVFXSystem.update(delta, playerPos, windChildPos) é o único rastreador visual de player/Wind Child.
- triggerSandFootstep(position) reutiliza no máximo maxContactEmitters.
- LaboratoryBuilder.update(delta, playerPos, additionalPositions, windSystem) continua dono da deformação física e não recebe sandVFX duplicado.
- createGameHarness() centraliza o setup já usado pelos testes de ciclo de vida; os testes de VFX não criam uma segunda inicialização parcial do jogo.

- [ ] Passo 1: Escrever testes vermelhos.

~~~js
it('passa o VFX manager e posições ao sistema de areia', () => {
  const game = createGameHarness();
  expect(game.sandVFX.vfxManager).toBe(game.vfxManager);
  game.start();
  game._loop();
  expect(game.sandVFX.lastPlayerFootstepTime).toBeDefined();
});

it('não cria ParticleSystem novo a cada pegada', () => {
  const vfx = new SandVFXSystem(scene, manager, { quality: 'medium' });
  const initial = manager.batchRenderer.systems?.length;
  vfx.triggerSandFootstep(new THREE.Vector3(0, 0, -55));
  vfx.triggerSandFootstep(new THREE.Vector3(0.5, 0, -55));
  expect(manager.batchRenderer.systems?.length).toBe(initial);
});
~~~

- [ ] Passo 2: Corrigir dependências e posições.

Usar new SandVFXSystem(this.renderer.scene, this.vfxManager, { quality: 'high' }). No loop, chamar sandVFX.update(delta, player.position, windChild.position). Remover o quinto argumento não utilizado de LaboratoryBuilder.update(). Conectar VFXManager ao WindParticleSystem, registrar setSandVFX() e fazer _applyWindBlast() chamar tanto o campo de deformação quanto GroundDustSystem.triggerDustBlast() e o pool de blast, com um único `effectivePower` numérico.

- [ ] Passo 3: Criar pool de emissores.

Criar quatro emissores na alta, dois na média e nenhum na baixa. triggerSandFootstep() escolhe o livre mais antigo, reposiciona, reinicia burst de 14 partículas e marca expiresAt; não executa new ParticleSystem() nem setTimeout() por pegada. O blast usa pool separado de dois sistemas e limite de 180 partículas.

- [ ] Passo 4: Aplicar qualidade e culling.

VFXManager.setQuality() atualiza sistemas de areia existentes. Pausar o emissor fora dos limites [-12, 12] × [-64, -46]. Não chamar setDepthTexture() sem verificar o método na versão instalada de BatchedRenderer. GroundDustSystem.update() deve retornar cedo quando não houver velocidade/rajada ativa, e a integração com WindParticleSystem deve evitar que `update()` percorra 120 partículas sem trabalho.

- [ ] Passo 5: Validar.

~~~powershell
npm test -- src/__tests__/SandVFXSystem.test.js src/__tests__/GameLifecycle.test.js
npm run lint
npm run test:e2e -- e2e/laboratory.smoke.spec.js e2e/sand.performance.spec.js
~~~

- [ ] Passo 6: Commitar.

~~~powershell
git add src/main.js src/world/LaboratoryBuilder.js src/effects/SandVFXSystem.js src/effects/VFXManager.js src/effects/GroundDustSystem.js src/wind/WindParticleSystem.js src/__tests__/SandVFXSystem.test.js src/__tests__/helpers/gameHarness.js
git commit -m "fix: pool sand contact effects and wire arena updates"
~~~

---

### Tarefa 6: Manter GPGPU opcional e corrigir caminho latente

**Arquivos:**
- Modificar: src/world/GPUComputeSandSystem.js:10-373
- Modificar: src/world/LaboratoryBuilder.js:10-35
- Modificar: src/main.js:44-50,295-300
- Criar: src/__tests__/GPUComputeSandSystem.test.js
- Criar: src/__tests__/helpers/webglHarness.js

**Interfaces:**
- new GPUComputeSandSystem(renderer, scene, { enabled = false, quality }) não aloca FBOs quando enabled é falso.
- setEnabled(enabled) é idempotente.
- triggerSandBlast(origin, power = 1) recebe exatamente dois argumentos.
- makeFakeRenderer({ webgl2 = true }) fornece o renderer mínimo para os testes de alocação/caminho headless sem criar um contexto WebGL real.

- [ ] Passo 1: Escrever testes vermelhos.

~~~js
it('não aloca 262.144 partículas por padrão', () => {
  const fakeRenderer = makeFakeRenderer();
  const system = new GPUComputeSandSystem(fakeRenderer, new THREE.Scene(), { enabled: false });
  expect(system.isHeadless).toBe(true);
  expect(system.PARTICLES).toBeUndefined();
});

it('limita o modo habilitado a 16.384 partículas', () => {
  const fakeRenderer = makeFakeRenderer();
  const system = new GPUComputeSandSystem(fakeRenderer, new THREE.Scene(), { enabled: true, quality: 'medium' });
  expect(system.PARTICLES).toBe(128 * 128);
});
~~~

- [ ] Passo 2: Corrigir wire-up sem mudar default.

LaboratoryBuilder recebe renderer explicitamente e chama new GPUComputeSandSystem(renderer, this.scene, { enabled: sandQuality.gpuParticles }). Todos os perfis mantêm gpuParticles: false até benchmark aprovar.

- [ ] Passo 3: Corrigir recursos e custo opt-in.

No modo habilitado, usar 128², HalfFloatType quando suportado, no máximo quatro esferas e atualização a 30 Hz. Liberar DataTexture, material, quad e geometria temporários dentro de _fillInitialData(); atualmente esses recursos não são todos descartados.

- [ ] Passo 4: Corrigir blast e terreno da simulação.

Trocar triggerSandBlast(origin, target, effectivePower) por triggerSandBlast(origin, effectivePower). Se habilitado, passar height field R8 ao shader; não manter groundY = 0.0 quando a areia visual tem elevação diferente.

- [ ] Passo 5: Validar default barato.

~~~powershell
npm test -- src/__tests__/GPUComputeSandSystem.test.js src/__tests__/GameLifecycle.test.js
npm run build
~~~

Esperado no modo padrão: zero render passes GPGPU, zero FBOs de areia e nenhum custo extra de entrada.

- [ ] Passo 6: Commitar.

~~~powershell
git add src/world/GPUComputeSandSystem.js src/world/LaboratoryBuilder.js src/main.js src/__tests__/GPUComputeSandSystem.test.js src/__tests__/helpers/webglHarness.js
git commit -m "fix: make GPU sand simulation opt-in and bounded"
~~~

---

### Tarefa 7: Integrar qualidade adaptativa, pixel ratio e sombras

**Arquivos:**
- Criar: src/engine/QualitySettings.js
- Criar: src/engine/QualityManager.js
- Modificar: src/engine/Renderer.js:27-75
- Modificar: src/entities/FlashlightSystem.js:16-24
- Modificar: src/main.js:28-60,304-341
- Modificar: src/engine/PerformanceProfiler.js:557-609
- Criar: src/__tests__/QualityManager.test.js

**Interfaces:**
- QualitySettings exporta LOW, MEDIUM, HIGH e ULTRA congelados com pixelRatio, shadowMapSize, antialias, sandQuality e profilerHz; ULTRA e HIGH usam sandQuality 'high', MEDIUM usa 'medium' e LOW usa 'low'.
- QualityManager.sample({ frameTimeMs, renderSubmissionMs, contextLost }) aplica histerese depois de 120 frames.
- Renderer.applyQuality(settings) altera pixel ratio, sombras e antialias sem recriar cena.
- PerformanceProfiler distingue renderSubmissionMs de gpuTimeMs; sem timer query, gpuTimeMs é null.

- [ ] Passo 1: Escrever testes vermelhos de histerese.

~~~js
it('desce após carga sustentada', () => {
  const manager = new QualityManager({ initial: 'high', warmupFrames: 120 });
  for (let i = 0; i < 119; i += 1) manager.sample({ frameTimeMs: 25, renderSubmissionMs: 10, contextLost: false });
  expect(manager.level).toBe('high');
  manager.sample({ frameTimeMs: 25, renderSubmissionMs: 10, contextLost: false });
  expect(manager.level).toBe('medium');
});

it('desce após perda de contexto', () => {
  const manager = new QualityManager({ initial: 'high' });
  manager.sample({ frameTimeMs: 8, renderSubmissionMs: 2, contextLost: true });
  expect(manager.level).toBe('low');
});
~~~

- [ ] Passo 2: Definir limites concretos.

LOW = pixelRatio 0.85, shadowMapSize 512, antialias false. MEDIUM = pixelRatio 1.0, shadowMapSize 1024, antialias true. HIGH = pixelRatio 1.25, shadowMapSize 1024, antialias true. ULTRA = pixelRatio 1.5, shadowMapSize 2048, antialias true. Iniciar em MEDIUM no Edge/AMD até o baseline comprovar HIGH.

- [ ] Passo 3: Aplicar ao renderer e à lanterna.

Substituir DPR fixo 1.5 por settings.pixelRatio, shadow map fixo 2048 por settings.shadowMapSize e sombra fixa 1048 da lanterna por Math.min(settings.shadowMapSize, 512) somente quando ligada.

- [ ] Passo 4: Corrigir profiler.

Adicionar contextLost, renderSubmissionMs, frameTimeP95, sandTriangles e sandTextureBytes. Usar EXT_disjoint_timer_query_webgl2 quando existir; sem extensão, não rotular submissão como GPU. Configurar `renderer.info.autoReset = false`, resetar uma vez por frame e somar explicitamente os passes GPGPU e o render final antes de publicar as métricas. Atualizar DOM no máximo a 10 Hz.

- [ ] Passo 5: Validar.

~~~powershell
npm test -- src/__tests__/QualityManager.test.js src/__tests__/Renderer.test.js src/__tests__/GameLifecycle.test.js
npm run lint
npm run build
npm run test:e2e -- e2e/sand.performance.spec.js
~~~

- [ ] Passo 6: Commitar.

~~~powershell
git add src/engine/QualitySettings.js src/engine/QualityManager.js src/engine/Renderer.js src/entities/FlashlightSystem.js src/main.js src/engine/PerformanceProfiler.js src/__tests__/QualityManager.test.js src/__tests__/Renderer.test.js src/__tests__/GameLifecycle.test.js
git commit -m "perf: adapt renderer quality to sand workload"
~~~

---

### Tarefa 8: Verificação final visual, memória e regressão

**Arquivos:**
- Modificar: e2e/sand.performance.spec.js
- Criar: docs/sand-performance-after.json
- Criar: docs/sand-visual-checklist.md
- Não modificar: arquivos não relacionados listados por git status --short

**Interfaces:**
- O E2E usa os mesmos estados e duração de docs/sand-performance-before.json.
- O checklist cobre macro-dunas, ripples, roughness, normal, pegada, decaimento, VFX, limites e entrada/saída.

- [ ] Passo 1: Executar suíte completa.

~~~powershell
npm test
npm run lint
npm run build
npm run test:e2e
~~~

- [ ] Passo 2: Executar comparação antes/depois.

~~~powershell
node scripts/sand-performance-baseline.mjs --duration=10000 --output=docs/sand-performance-after.json
~~~

Comparar p50/p95/p99, draws, triângulos, texturas, geometria, stamps, uploads e contextLost. Rejeitar se a aparência melhorar mas p95 ou memória piorarem além dos limites.

- [ ] Passo 3: Fazer teste manual controlado.

No Edge, usar a mesma resolução/DPR: abrir, entrar, aproximar-se da areia, atravessar a arena, voltar, ligar/desligar lanterna, executar blast e repetir três vezes. Registrar menor FPS, frame time p95 e perda de contexto.

- [ ] Passo 4: Registrar checklist visual.

Marcar: textura dourada sem ruído quadriculado; ripples coerentes; pegadas visíveis; recuperação gradual; ausência de pop na troca de qualidade; VFX limitado; saída da arena sem manter partículas/updates.

- [ ] Passo 5: Revisar diff.

~~~powershell
git diff --check
git status --short
git diff --stat
~~~

Verificar que nenhum dist/, log, arquivo temporário ou mudança não relacionada foi incluído.

- [ ] Passo 6: Commitar documentação.

~~~powershell
git add e2e/sand.performance.spec.js docs/sand-performance-after.json docs/sand-visual-checklist.md
git commit -m "test: verify sand visuals and performance budget"
~~~

## Revisão do plano

- Cobertura: geometria, mapas PBR, shader, Canvas/deformação, pegadas físicas, VFX, GPGPU, sombras, pixel ratio, profiler, lifecycle, E2E e comparação antes/depois.
- Causa atual versus risco futuro: GPGPU e VFX foram classificados como inativos/latentes por causa do wire-up; não serão usados como explicação do travamento sem medição.
- Consistência: SandQualityProfile fornece campos consumidos por terreno, VFX, GPGPU e qualidade; SandDeformationField fornece data, stamp, sampleWorld, advance e consumeDirty; PerformanceStats define percentile para baseline/testes.
- Integração: createGameHarness e makeFakeRenderer são explicitamente criados como helpers de teste; renderer.info.autoReset e passes GPGPU/render final têm regra de agregação definida.
- Não há etapa vaga: cada tarefa lista arquivos, interfaces, teste, comando de validação, aceite e commit.
- Se for necessário dividir: (1) baseline + terreno/deformação, (2) shader/texturas/qualidade, (3) VFX/GPGPU. A Tarefa 1 deve vir primeiro.
