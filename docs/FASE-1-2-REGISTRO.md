# Registro de execução — Fases 1 e 2

## Decisões confirmadas

- Sala `x[-40,-28], z[-22,-6]`: `ALA DE MANEQUINS`.
- Sala `x[-14,14], z[-66,-46]`: `SALA DE TESTES - CONFIRMED 42`.
- Branch local: `refactor/fase-1-lifecycle`; não existe remoto configurado.
- O projeto não possui integração de IA, credenciais ou contexto externo de IA.

## Fase 1

- `a40c62a`: cache de placas corrigido; Vitest adicionado; revisão aprovada.
- `a34919e`: `RoomData` centralizado; revisão aprovada.
- `0232d7e`: ownership e dispose do laboratório isolados; revisão aprovada.
- `907a9b5`: RAF, resize, timer de rajada e lifecycle implementados; revisão encontrou um defeito pendente no HUD.

### Achado aberto — lifecycle

- P1: `HUD` registra listeners anônimos de iniciar/retomar e não expõe `destroy()`. Após recriar `Game`, uma instância destruída pode responder aos botões e reativar áudio já disposto. A correção deve guardar handlers estáveis, removê-los em `HUD.destroy()` e proteger `Game.start()`/`resume()` quando destruído. O teste deve usar os botões reais, não um mock que inventa `HUD.destroy()`.

## Fase 2 — preparação paralela

- Navegação/colisão: definir contrato de rota com resultado estruturado, colisão por eixo do Wind Child e política para obstáculos dinâmicos.
- Estado: WindChild será a única fonte de poder, energia e felicidade; PlayerController manterá input/câmera/movimento.
- Habilidade: projetar estado pronto/carga/liberação/cooldown antes de adicionar consumo de energia.
- Impulso: preservar explicitamente a política atual de velocidade antes de unificar vento contínuo e rajada.
- Menu: confirmar raycast, foco, teclas e conflito atual de Escape antes de alterar UX.

### Estado do Wind Child — evidências

- `PlayerController` duplica `name`, `powerLevel`, `happiness` e `energy`, sem consumidores fora do construtor. Remover somente esses quatro campos; preservar `health`, câmera, input e movimento.
- `WindChild` já é a fonte efetiva de poder, felicidade e energia. Preservar seus defaults atuais `5/80/90`, em vez dos valores legados divergentes `5/85/100` do PlayerController.
- Acrescentar `WindChild.name` como nome de domínio; manter `model.name` como identificador técnico da cena.
- Remover o fallback `windChild || player` do RadialMenu. Sem WindChild, não exibir telemetria do jogador.
- O HUD permanece vinculado ao jogador para sala e saúde; movê-lo criaria uma mudança de responsabilidade fora de escopo.
- Fix pendente da revisão: remover valores estáticos/fallback `1/85/100` do Radial e sua marcação inicial divergente; o menu deve refletir apenas atributos existentes no Wind Child (`5/80/90`).
- Fix pendente da revisão: o nó técnico do PlayerController não deve usar identidade `Wind Child`/`isWindChild`; reservar essa identidade ao sujeito real.

### Navegação e colisão — evidências

- `findPath()` hoje confunde rota completa, destino ajustado e rota parcial em um mesmo array. Migrar para resultado estruturado e executar somente `status: 'complete'`.
- Novo comando inválido deve limpar a rota antiga; a política é “último comando vence”.
- O Wind Child recebe colisores, mas não os usa. Aplicar resolução local X/Z, subpassos e vetores/AABB reutilizáveis; colisão local é a autoridade final.
- Grid e portas continuam estáticos nesta fase. Painéis de portas ficam visuais, e bloqueio dinâmico sustentado cancela a rota em vez de replanejar contra o mesmo grid.
- A migração de `findPath()` para resultado estruturado deve atualizar `WindChild` e `PlayerController` no mesmo commit; não usar compatibilidade oculta com arrays.

### Habilidade de vento — decisões propostas

- Extrair `WindAbilitySystem` dirigido por `update(delta)`: `ready → charging → cooldown → ready`; a liberação é evento, não estado durável.
- Congelar alvo, origem, alvo e atributos no início; consumir energia na liberação. Pausa durante carga cancela sem custo; pausa no cooldown congela.
- Preservar física atual: rajada substitui velocidade; vento ambiente continua aditivo; FX permanece separado de potência física até decisão posterior.

### Menu e impulso — evidências

- O clique direito atual abre radial em qualquer ponto; raycast deve atingir somente o modelo real do Wind Child.
- Escape deve ser interceptado em captura enquanto modal estiver aberto, para fechar radial sem pausar o jogo.
- Setores precisam de foco, `menuitem`, roving tabindex, setas, Enter/Espaço e restauração de foco.

## Fase 3 — qualidade e entrega

- Adotar ESLint flat com `eslint:recommended`, globals browser/node e Prettier; não introduzir regras opinativas ou de complexidade antes de normalizar a base.
- Usar estilo atual: 2 espaços, aspas simples, ponto e vírgula, `printWidth: 120`.
- Formatação mecânica deve ter commit separado; `format:check` entra como gate somente depois da normalização.
- Os cinco `transform_*` são scripts textuais destrutivos, sem referências ou scripts npm; removê-los sem executá-los, preservando o histórico Git.

### Smoke, CI e documentação

- Playwright deve testar o build de produção servido por `vite preview`, com Chromium e WebGL funcional; não usar screenshot ou FPS como gate.
- Smoke mínimo: boot/render, iniciar, TacMap abre/fecha, pausa/retoma e ausência de pageerror/console.error/requisição local falha.
- Bloquear Google Fonts no teste para remover rede externa sem ocultar falhas locais.
- Radial só entra no smoke após o raycast e acessibilidade da Fase 2; clicar por coordenada fixa é frágil.
- CI usa `npm ci`, unitários, Chromium, E2E e upload dos relatórios. README documenta Node, WebGL, controles, testes e ausência de secrets/IA.
- Adicionar política `.gitattributes` LF para que `format:check` seja reprodutível em clones Windows com autocrlf.

### Fechamentos e achados desta rodada

- `a30d15b`: blast extraído para `WindImpulse`; revisão confirmou thresholds, caps, lift vertical e ordem física sem deriva. Lacunas não bloqueantes: faltam asserts isolados para tipo desconhecido e ponto exato de início dos caps.
- `93d66a5` + `51b1570`: habilidade de vento determinística com carga, cooldown, energia e `dispose()` que libera `owner`/callback; re-revisão sem findings.
- Menu radial em implementação: raycast valida o ancestral do modelo real do Wind Child; chão/jogador não abrem o menu; setores têm `menuitem`, foco roving, setas, Enter/Espaço, Escape em captura e retorno de foco ao canvas. Testes focados atuais: 33/33.
- Achado P1 do smoke: build de produção removia `console.*` via Terser e podia mascarar erros WebGL. Correção em andamento separa o modo `e2e` sem `drop_console`, adiciona `gl.getError()` e um teste de política Vite; smoke + runtime guard já passaram 2/2 após essa mudança.
- O ambiente Windows apresentou falhas intermitentes `CreateProcessAsUserW 1312`; comandos de validação foram repetidos com execução elevada, sem alterar o diagnóstico do produto.
- `17db82d`: HUD passou a acumular o delta real do frame; testes confirmam tempo equivalente em 30/60 FPS e revisão não encontrou regressões.
- `b0327f6`: runtime de portas e objetos de teste extraído para `DoorSystem` e `TestObjectSystem`, com aliases compatíveis no builder e dispose idempotente. A criação de arquitetura/decoração e colliders ainda permanece no `LaboratoryBuilder` por segurança; a extração foi incremental e sem alteração visual.
- Revisão do menu encontrou P2: o handler global de Enter/Espaço pode interceptar `.power-btn` do submenu de nível de poder. Correção TDD foi encaminhada ao agente do menu antes do gate final.
- Decisão do projeto: Node.js 24 é requisito oficial. `package.json`, `package-lock.json`, `.nvmrc`, CI e README devem permanecer alinhados em Node 24.

### Gate final executado em 2026-07-28

- Node efetivo: `v24.18.0` / npm `11.10.1`.
- `npm run lint`: aprovado.
- `npm run format:check`: aprovado.
- `npm test`: 15 arquivos, 84 testes aprovados.
- `npm run build`: aprovado, 28 módulos transformados.
- `npm run test:e2e`: 2/2 aprovados; smoke WebGL com `gl.getError() === gl.NO_ERROR` e runtime guard de `console.error`.
- `git diff --check`: limpo; branch sem alterações pendentes após o registro.
