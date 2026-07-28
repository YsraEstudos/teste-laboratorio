# Fase 2 — contrato de navegação e colisão

## Escopo desta fatia

- `NavigationGrid.findPath()` agora sempre retorna um resultado estruturado.
- `WindChild` e `PlayerController` executam somente rotas com `status: 'complete'`.
- O comando mais recente sempre substitui o anterior; resultado inválido ou parcial limpa a rota em execução.
- A colisão local do `WindChild` é a autoridade final do movimento.
- Portas continuam apenas visuais para navegação: o grid e a lista de colisores permanecem estáticos.

## Contrato de rota

Todo resultado contém:

- `status`: `complete`, `partial` ou `invalid`;
- `reason`: motivo explícito ou `null`;
- `waypoints`: pontos simplificados da rota;
- `requestedTarget`: alvo solicitado;
- `resolvedTarget`: célula navegável usada como alvo pelo grid;
- `adjustedStart` e `adjustedTarget`: indicam correção de origem/alvo.

Motivos atuais:

- `invalid-coordinates`;
- `start-unwalkable`;
- `target-unwalkable`;
- `target-unreachable`;
- `start-adjusted`;
- `target-adjusted`;
- `start-and-target-adjusted`.

## Colisão local do Wind Child

- AABB reutilizável com raio horizontal `0.38`.
- Movimento dividido em subpassos de no máximo `0.18`.
- Resolução separada nos eixos X e Z para permitir deslizamento local.
- Distância por quadro limitada à distância do waypoint, sem ultrapassagem.
- Bloqueio sem progresso por `0.5 s` cancela a rota com:
  - `navigationState: 'cancelled'`;
  - `navigationReason: 'blocked'`.
- Chegada encerra a rota com:
  - `navigationState: 'complete'`;
  - `navigationReason: 'arrived'`.

## Evidência TDD

RED, antes da produção:

```text
npm test -- src/__tests__/NavigationGrid.test.js src/__tests__/WindChildNavigation.test.js src/__tests__/PlayerControllerNavigation.test.js
3 arquivos falharam; 12 testes falharam pelos comportamentos ausentes esperados.
```

GREEN focado:

```text
3 arquivos passaram; 12 testes passaram.
```

Verificação integrada:

```text
npm test
8 arquivos passaram; 34 testes passaram.

npm run build
23 módulos transformados; build concluído.
```

## Risco residual

A validação automatizada cobre contrato, rotas parciais/inválidas, colisão X/Z, subpassos, waypoint e timeout de bloqueio. Esta fatia não inclui um play-test visual do laboratório completo nem replanejamento dinâmico; um obstáculo novo sustentado cancela a rota como definido.
