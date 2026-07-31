# Comparação de backends da deformação de areia

## Escopo e decisão atual

O laboratório usa uma arena fixa de X `[-12, 12]` e Z `[-64, -46]`. O estado autoritativo fica em `SandDeformationField`: os `TypedArray` CPU são consultados pela física e alimentam as texturas consumidas pelo shader. A decisão operacional para os perfis padrão é `cpuR8`.

Essa é uma decisão baseada no tamanho fixo da arena, na necessidade de consulta física sem readback e nos resultados do microbenchmark CPU abaixo. Ela não foi inferida a partir do `snowflow_demo`.

## Comparação

| Candidato | Custo por frame e uploads | Readback e física | Resolução / brushes | Persistência e lifecycle | Compatibilidade | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| CPU `TypedArray` + `DataTexture` | Trabalho proporcional às regiões dos brushes e tiles ativos; três uploads somente quando `dirty`; nenhum upload parado | Sem readback; `sampleWorld` consulta diretamente a fonte autoritativa | 128², 192² ou 256²; fila pré-alocada por perfil (32/64/96) | Arrays simples, serializáveis e dispose idempotente | WebGL2 usa R8; WebGL1 publica uma visão RGBA8 pré-alocada | Escolhido para os perfis padrão |
| GPU render targets ping-pong | Um pass WebGL2 por atualização; estado e brushes precisam permanecer em textura; custo depende da resolução e do número de iterações do shader | Readback síncrono seria proibido; sem readback, a física precisa de uma representação paralela ou de um contrato de consulta GPU ainda não validado | Atualmente limitado ao caminho experimental quadrado e a até 96 brushes | Render targets, material, textura de brushes e pass exigem lifecycle mais complexo | WebGL2 + `EXT_color_buffer_float`; não é fallback WebGL1 | Mantido isolado para benchmark, não habilitado por padrão |
| Híbrido CPU/GPU | Pode combinar consulta CPU e render GPU, mas mantém duas representações e custo de sincronização | Sem readback ainda há risco de divergência; com readback viola o orçamento por frame | Duplicação de estado cresce com resolução e canais | Maior risco de lifecycle, persistência e invalidação | Exige tratar separadamente WebGL1/WebGL2 | Não promovido sem prova de coerência e ganho |

## Evidência medida

Microbenchmark local, 120 frames, cada frame com a carga indicada, `flush(1/60)` e `consumeDirty()`:

| Resolução | Brushes/frame | Tempo total | Tempo/frame | Uploads |
| ---: | ---: | ---: | ---: | ---: |
| 128² | 32 | 14.87 ms | 0.124 ms | 120 |
| 128² | 64 | 11.02 ms | 0.092 ms | 120 |
| 128² | 96 | 13.64 ms | 0.114 ms | 120 |
| 192² | 32 | 6.95 ms | 0.058 ms | 120 |
| 192² | 64 | 13.03 ms | 0.109 ms | 120 |
| 192² | 96 | 19.91 ms | 0.166 ms | 120 |
| 256² | 32 | 10.77 ms | 0.090 ms | 120 |
| 256² | 64 | 20.55 ms | 0.171 ms | 120 |
| 256² | 96 | 33.17 ms | 0.276 ms | 120 |

Os números acima medem a parte CPU e o agendamento de upload, não o tempo efetivamente gasto pelo driver WebGL. O benchmark de referência do navegador continua obrigatório para decidir qualquer promoção do caminho GPU.

O benchmark isolado no mesmo Chromium/WebGL2 headless (`WebKit WebGL`, 256², 15 frames) mediu `cpuR8` em 0,633 ms/frame com 64 brushes e 0,647 ms/frame com 96 brushes. O `gpuPingPong` mediu 0,807 ms/frame com 64 brushes e 1,133 ms/frame com 96 brushes. Ambos registraram 15 uploads lógicos, zero readback e 196.608 bytes autoritativos; no candidato GPU atual, o campo CPU ainda é mantido para grounding, portanto o pass GPU é custo adicional e não uma aceleração líquida. Com essa evidência, CPU permanece a escolha para o laboratório.

O baseline histórico de referência (`docs/sand-performance-before.json`) registrava WebGL2, 512² e 32.768 triângulos, com p95 de 463.3 ms na entrada, 757.2 ms na aproximação e 806 ms perto da areia. Ele confirma que havia um problema de escala/performance, mas não isola sozinho a causa.

Na coleta curta pós-implementação (`Chromium 151.0.7922.34`, WebGL2, 1280×720, high, 8 frames por estado), o terreno publicado ficou em 256² e 8.192 triângulos, com `cpuR8`, 196.608 bytes autoritativos, zero uploads enquanto não havia deformação e `readback: false`. Os p95 observados foram 501 ms na entrada, 1.486,9 ms na aproximação e 497 ms perto da areia. Portanto, houve redução estrutural de geometria/resolução em relação ao baseline histórico, mas o ambiente ainda não atende 16,7 ms; o gate oficial de 120 frames permaneceu falhando por timeout de 30 s.

O A/B curto com o mesh de areia oculto e os VFX de areia dispostos mostrou p95 de 469,7 ms, 1.056,1 ms e 496,1 ms nos mesmos estados. O isolamento posterior confirmou a divisão: sem renderização, os frames ficaram em 17,2–20,2 ms; com a simulação pausada e render ativo, ficaram em 431–448 ms; sem areia e sem sombras, em 396–411 ms. A latência de centenas de ms não desapareceu; isso descarta a deformação/partículas como causa única do congelamento e aponta para o custo geral do laboratório no renderer `WebKit WebGL`/SwiftShader.

Para esse ambiente, `Renderer` agora detecta SwiftShader/software, desativa sombras, converte materiais padrão para um caminho unlit e reduz o buffer para 25%; o material da areia mantém o shader de deslocamento e os uniforms autoritativos. O gate oficial de 120 frames passou a executar sem erro de shader, mas ainda registrou p95 de 19,2 ms, acima do limite estrito de 16,7 ms; o jitter residual do Chromium/SwiftShader impede declarar esse gate verde. O fallback é produção-condicionado ao renderer de software; GPU real mantém escala, iluminação e materiais originais.

## Regras de promoção do caminho GPU

`experimentalGpu: true` é necessário além de WebGL2 e `EXT_color_buffer_float`; os perfis low/medium/high mantêm `gpuParticles: false`. O caminho não pode ser considerado substituto enquanto o benchmark de referência não demonstrar, em conjunto:

1. p95 e p99 melhores que o campo CPU na mesma resolução e carga;
2. zero readback síncrono por frame;
3. amostras de grounding equivalentes às amostras renderizadas;
4. persistência/restauração dos canais depth, berm e compression;
5. dispose/recriação sem crescimento de texturas, geometries ou render targets.

Até essa evidência existir, o campo CPU permanece a única fonte usada pelo terreno, contatos e física nos perfis normais.
