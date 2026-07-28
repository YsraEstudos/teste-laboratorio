# Laboratório 3D

Protótipo de exploração 3D no navegador, construído com Three.js e Vite. O jogador percorre um laboratório,
acompanha a Wind Child e consulta uma planta tática das salas.

## Requisitos

- Node.js 20 ou mais recente;
- npm (o lockfile é a fonte das versões instaladas);
- navegador moderno com WebGL 2 habilitado;
- aceleração gráfica ativa ou uma implementação WebGL por software.

Não há backend, banco de dados ou serviço externo obrigatório. O carregamento normal usa Google Fonts para a fonte
Rajdhani; a suíte E2E bloqueia essa rede externa e valida o jogo com os fallbacks locais de fonte.

## Instalação e execução

```bash
npm ci
npm run dev
```

O Vite abrirá o endereço de desenvolvimento. Para testar o artefato de produção:

```bash
npm run build
npm run preview
```

O conteúdo de `dist/` é gerado e não deve ser versionado.

## Controles

| Entrada                         | Ação                                       |
| ------------------------------- | ------------------------------------------ |
| Botão `ENTRAR NO LABORATÓRIO`   | Inicia a simulação                         |
| Clique esquerdo no chão         | Move o jogador até o ponto escolhido       |
| `WASD` ou setas para cima/baixo | Movimento manual                           |
| `Shift`                         | Corre durante o movimento manual           |
| `Ctrl` ou `C`                   | Agacha                                     |
| `Espaço`                        | Pula                                       |
| Roda do mouse                   | Ajusta o zoom                              |
| `M`                             | Abre ou fecha o TacMap                     |
| `Escape`                        | Pausa o jogo                               |
| Botão `CONTINUAR`               | Retoma o jogo                              |
| Clique direito                  | Abre o menu contextual atual da Wind Child |
| `F2`                            | Alterna a telemetria de desempenho         |

## Qualidade e testes

```bash
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
```

Os testes unitários usam Vitest. O smoke E2E usa Playwright com Chromium contra o build produzido por
`npm run build` e servido por `vite preview` em `127.0.0.1:4173`.

O smoke cobre:

- boot e drawing buffer WebGL funcional;
- início da simulação;
- abertura e fechamento do TacMap;
- pausa e retomada;
- ausência de `pageerror`, `console.error`, requisição local abortada ou resposta HTTP local com erro.

Google Fonts é interceptado dentro do navegador durante o E2E, sem ocultar falhas dos assets locais. Screenshot,
vídeo e trace são artefatos de diagnóstico em falhas; comparação visual e FPS não são gates. O menu radial fica fora
do smoke até o fluxo de raycast e acessibilidade estar estabilizado.

Para depuração visual local:

```bash
npm run test:e2e:headed
npx playwright show-report
```

Na primeira execução local, instale o Chromium compatível com a versão travada do Playwright:

```bash
npx playwright install chromium
```

## Integração contínua

O workflow em `.github/workflows/ci.yml` roda em pushes e pull requests. Ele instala pelo `package-lock.json`, executa
lint, formatação, unitários e build, instala o Chromium e roda o smoke E2E. Relatórios e evidências de falha do
Playwright são enviados como artifact.

## Estrutura

```text
src/
  effects/    efeitos visuais
  engine/     renderer, input e telemetria
  entities/   jogador e Wind Child
  ui/         HUD, TacMap e menu contextual
  wind/       simulação e áudio de vento
  world/      salas, laboratório, navegação e texturas
  __tests__/  testes unitários
e2e/          smoke de navegador e guardas de runtime
docs/         decisões e registros técnicos
```

## Dados, secrets e IA

O projeto roda inteiramente no cliente e não possui integração de IA, analytics, autenticação ou coleta de dados.
Nenhuma chave, token ou secret é necessário. Arquivos `.env*` locais são ignorados por padrão, exceto um eventual
`.env.example` sem credenciais.
