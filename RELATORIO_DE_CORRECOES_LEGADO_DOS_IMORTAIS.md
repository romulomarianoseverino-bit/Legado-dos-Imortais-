# Relatório de Correções Técnicas — Legado dos Imortais: Edição Lendária

Este documento registra a auditoria técnica direcionada, as causas raiz diagnosticadas, as correções aplicadas, os testes executados e os procedimentos para sincronização com o GitHub e geração do aplicativo Android (APK).

---

## 1. Resumo Executivo

Todas as funcionalidades anteriores do projeto (regras do tabuleiro, deuses Zeus/Poseidon/Hades/Atena, tela inicial mitológica, controles de áudio 0%–100%, P2P multiplayer, sistema de ranking, segurança do `server.ts`, backups/rollback e estrutura Capacitor Android) foram integralmente preservadas.

As falhas reais relatadas em execução — áudio instável/bloqueado ou sem fallback offline e erro `"Motor Three.js indisponível no momento. Verifique o carregamento do módulo 3D."` na Oficina 3D — foram diagnosticadas na raiz e corrigidas.

---

## 2. Problemas Encontrados e Causas Raiz

### 2.1. Falha no Sistema de Áudio (Web e WebView Android)
1. **Expiração do gesto do usuário (`NotAllowedError`) após carregamento assíncrono:** `iniciarDoLobby()` aguardava `await prepararEIniciarPartida(...)` (fontes, imagens, API de ranking) antes de chamar `iniciarMusicaPartida()`, fazendo o `<audio id="bg-music-player">` perder o token de ativação de usuário no Chrome e Android WebView.
2. **Dependência rígida do CDN Tone.js sem contingência offline:** Quando `window.Tone` não estava carregado (ex.: WebView Android offline ou CDN indisponível) ou falhava durante `Tone.start()`, `garantirAudioContextAtivo()` retornava `false` e todos os efeitos sonoros ficavam mudos.
3. **Múltiplos contextos / drift de agendamento futuro:** O `sfxPool.lastTime[chave]` não era limitado caso `AudioContext.currentTime` reiniciasse ou pausasse em segundo plano, podendo agendar notas dezenas de segundos no futuro.
4. **Retorno ao Lobby e Segundo Plano:** Ao voltar ao Lobby (`reiniciarPartida()` / `fecharModalFimPartidaEIrAoLobby()`), a música continuava sendo reativada na tela inicial, e ao ocultar a aba/WebView não havia pausa limpa antes da perda de foco de áudio.
5. **Efeitos de ações de jogo:** Compras, construções/evoluções de templos, pagamento de aluguel, bênçãos do Oráculo de Delfos e eventos do Tártaro não disparavam feedback sonoro dedicado.

### 2.2. Falha no Carregamento da Oficina 3D (`"Motor Three.js indisponível no momento"`)
1. **Bloqueio HTTP `403` no servidor de desenvolvimento (`server.ts`):** Em modo de desenvolvimento (`NODE_ENV !== 'production'`), o Vite pré-empacota módulos ES de dependências em `/node_modules/.vite/deps/three.js`. O escudo de caminhos do `server.ts` bloqueava **tudo** sob `node_modules/*` com `403 Forbidden`, impedindo que `/src/pieces3d.ts` carregasse `three`, deixando `window.Legado3D` indefinido e fazendo a Oficina 3D e as abas `.GLB/.GLTF` e `Totem Foto` falharem silenciosamente.
2. **Acesso síncrono ao `window.Legado3D` nos seletores de arquivo:** `processarArquivo3DSelecionado` e `processarFotoTotemSelecionada` retornavam silenciosamente caso `window.Legado3D` ainda estivesse terminando de carregar, sem aguardar `aguardarModulo3D()` nem exibir diagnóstico.
3. **Ciclo WebGL, redimensionamento e imagens enviadas na aba `.GLB`:** Faltava tratamento de `try/catch` na criação do `WebGLRenderer`, listeners `webglcontextlost`/`webglcontextrestored`, método `resize()` explícito ao abrir o modal oculto ou trocar de aba, e mensagem instrutiva diferenciando imagens `.jpg/.png/.webp` enviadas por engano na aba `.GLB / .GLTF` (orientando o usuário para a aba `Totem Foto`).
4. **Miniaturas sem WebGL:** Se o navegador/WebView não suportasse criação de um segundo contexto WebGL para miniatura, `renderPieceThumbnailDataUrl` podia lançar exceção e impedir o salvamento no IndexedDB.

---

## 3. Arquivos Modificados e Criados

- **`server.ts`**
  - Liberado exclusivamente `/node_modules/.vite/deps/` e `/node_modules/.vite` **apenas em modo `development`** (`NODE_ENV !== 'production'`), mantendo `403 Forbidden` para todo o restante de `node_modules/*` em desenvolvimento e `100%` de `node_modules/*` bloqueado em produção, além de `.env`, `.backups/`, `server.ts`, `*.bak`, etc.
  - Adicionada diretiva segura `worker-src 'self' blob:;` ao cabeçalho `Content-Security-Policy` mantendo todas as demais restrições intactas.
- **`vite.config.ts`**
  - Adicionado `optimizeDeps.include` para `three`, `OrbitControls.js`, `GLTFLoader.js` e `RoomEnvironment.js`.
- **`src/pieces3d.ts`**
  - Adicionado `isWebGLAvailable()` e expostos `isWebGLAvailable` e `disposeSceneObject` em `window.Legado3D`.
  - Melhorada validação em `validarArquivo3D` com erro explícito quando usuário tenta enviar imagem (`.png`, `.jpg`, `.jpeg`, `.webp`, etc.) na aba `.GLB / .GLTF`.
  - Adicionado suporte a seleção de imagem por extensão mesmo quando o WebView Android omite `file.type` em `cropPhotoToSquareDataUrl`.
  - Adicionado `try/catch` + `finally` (descarte seguro de GPU/PMREM) e fallback de miniatura 2D em `renderPieceThumbnailDataUrl` para que o salvamento no IndexedDB nunca falhe.
  - Adicionados `try/catch` no `WebGLRenderer`, `touchAction = 'none'`, método `resize()` (com `requestAnimationFrame`) e recuperação `webglcontextlost`/`webglcontextrestored` em `mountWorkshopViewer`.
- **`index.html`**
  - **Áudio:** Contexto único `AudioContext` nativo sincronizado com `Tone.js`, desbloqueio síncrono no gesto do clique (`desbloquearAudioNaInteracaoSincrona`), síntese Web Audio nativa offline-safe como fallback completo para todos os efeitos sonoros (`dados`, `pouso`, `passos`, `vitória`, `derrota`, `compra`, `construcao`, `aluguel`, `bencao`, `prisao`), proteção contra drift futuro em `obterTempoSeguroSfx`, limpeza imediata de nós ativos em `pararSomVitoria()`, pausa limpa em segundo plano (`visibilitychange`/`pagehide`) e retomada controlada somente com partida ativa, preservação dos sliders 0%–100% independentes e pausa limpa ao retornar ao Lobby.
  - **Oficina 3D & Tabuleiro:** `processarArquivo3DSelecionado` e `processarFotoTotemSelecionada` passam a aguardar `aguardarModulo3D`, exibir mensagens claras, liberar `testGroup` após validar `.GLB/.GLTF` e limpar `<input type="file">` após equipar; `trocarAbaOficina3D` restaura o preview do rascunho da aba ativa e força `resize()`; `abrirOficinaPecas3D` trata indisponibilidade de WebGL graciosamente; `#players-panel` exibe miniatura da peça 3D equipada junto ao jogador.
- **`RELATORIO_DE_CORRECOES_LEGADO_DOS_IMORTAIS.md`** *(criado nesta etapa)*.

---

## 4. Testes Executados e Resultados Obtidos

| Teste | Comando / Método | Resultado | Observação Honesta |
| :--- | :--- | :--- | :--- |
| Compilação de Produção | `npm run build` (`vite build`) | **Aprovado** | Gerou `dist/` completo sem erros (`three` empacotado no bundle). |
| Verificação TypeScript | `npm run lint` (`tsc --noEmit`) | **Aprovado** | Zero erros de tipagem em `server.ts`, `src/pieces3d.ts` e React/Vite. |
| Sincronização Capacitor | `npx cap sync android` | **Aprovado** | Assets de `dist/` copiados para `android/app/src/main/assets/public/` em 0.097s. |
| Servidor Dev (`NODE_ENV=development`) | Requisições HTTP reais na porta `3421` | **Aprovado** | `/src/pieces3d.ts` (200), `/node_modules/.vite/deps/three.js` (200), `.mp3` (200), `/.env` (403), `/.backups/rankings-data.json` (403), `/node_modules/express/package.json` (403). |
| Servidor Prod (`NODE_ENV=production`) | Requisições HTTP reais na porta `3422` | **Aprovado** | `/` (200), `.mp3` (200), `/node_modules/.vite/deps/three.js` (403), `/.backups/rankings-data.json` (403). |
| Presets & Validador 3D (`src/pieces3d.ts`) | Execução via `tsx` com Three.js + `GLTFLoader` | **Aprovado** | 6 presets construídos; rejeição de `.jpg` e `>5MB` e URI externa validada; `.glb` v2 e `.gltf` v2 real carregados e descartados. |
| Ciclo de Áudio (Simulação VM Offline) | Execução do `<script>` de `index.html` via `node:vm` | **Aprovado** | Desbloqueio síncrono no clique, clamp de `lastTime` futuro, 50 rodadas sem `Tone.js` gerando osciladores nativos, `pararSomVitoria()` parando osciladores ativos, sliders `0%–100%`, pausa/retomada por `visibilitychange` e pausa limpa ao voltar ao lobby. |
| Renderização WebGL em navegador visual, alto-falante físico e compilação/instalação APK no Android | — | **Não executável no contêiner** | Este ambiente Linux headless não possui Chromium/Playwright gráfico, placa de áudio física nem Android SDK/emulador. Recomenda-se teste direto pelo usuário no navegador e via GitHub Actions + dispositivo Android. |

---

## 5. Dependências Instaladas / Conferidas

Todas já presentes no `package.json`:
- `three` (`^0.187.0`) e `@types/three` (`^0.187.0`)
- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` (`^8.6.2`)

---

## 6. Estado Atual dos Módulos

- **Áudio:** Funcional na arquitetura unificada (MP3 local + `AudioContext` único + `Tone.js` online + síntese Web Audio nativa offline-safe + teardown limpo de vitória/derrota + sliders 0%–100%).
- **Oficina 3D (`Mitologia 3D`, `.GLB / .GLTF`, `Totem Foto`):** Módulos carregando sem bloqueio 403 em dev e empacotados em produção; 6 presets procedurais, validador rigoroso `.glb`/`.gltf` 2.0 (5 MB / 120k triângulos / sem URIs externas) e Totem Fotográfico 3D local (PNG/JPG/WebP até 4 MB).
- **Biblioteca Pessoal (IndexedDB `LegadoImortaisPecas3DDB`) e Tabuleiro:** Salvamento/listagem/exclusão/equipamento nos slots 1..4 com restauração ao padrão clássico do deus e exibição nos peões e painel de jogadores.
- **Capacitor Android & Workflow APK:** `capacitor.config.ts` (`webDir: 'dist'`, `androidScheme: 'https'`), pasta `android/` sincronizada, `AndroidManifest.xml` com permissões `INTERNET` e `ACCESS_NETWORK_STATE`, e `.github/workflows/build-android-apk.yml` pronto para gerar `app-debug.apk`.

---

## 7. Inventário de Arquivos para Sincronizar com o GitHub

Repositório alvo: **`https://github.com/romulomarianoseverino-bit/Legado-dos-Imortais-`** (branch `main`).

Arquivos e pastas essenciais que devem estar no commit (não inclua `node_modules/`, `dist/`, `.backups/` nem `.env`):
- `index.html`
- `server.ts`
- `package.json` (e `package-lock.json` / `bun.lock` se existirem)
- `vite.config.ts`
- `tsconfig.json`
- `metadata.json`
- `capacitor.config.ts`
- `.env.example`
- `.gitignore`
- `src/` (incluindo `src/pieces3d.ts`, `src/App.tsx`, `src/main.tsx`, etc.)
- `public/assets/aistudio/the_arch_of_eternal_light_8a53099f.mp3` e demais arquivos em `public/`
- `android/` (exceto `android/.gradle/`, `android/build/`, `android/app/build/`, já ignorados pelo `.gitignore`)
- `.github/workflows/build-android-apk.yml`
- `RELATORIO_DE_CORRECOES_LEGADO_DOS_IMORTAIS.md`
- `RELATORIO_DE_IMPLEMENTACAO_LEGADO_DOS_IMORTAIS.md`

---

## 8. Passo a Passo para Sincronizar com o GitHub e Gerar o APK no GitHub Actions

### 8.1. Sincronização com o GitHub (sem sobrescrever versões antigas por engano)
1. Baixe/exporte o projeto atual do AI Studio para uma pasta local no seu computador (ou clone primeiro o repositório e copie estes arquivos atualizados para dentro dele, exceto `.git/`).
2. Caso ainda não tenha o repositório remoto vinculado na pasta local:
   ```bash
   git init -b main
   git remote add origin https://github.com/romulomarianoseverino-bit/Legado-dos-Imortais-.git
   ```
3. Se o repositório no GitHub já tiver histórico anterior e você quiser preservar/evitar sobrescritas cegas, traga o histórico remoto antes ou faça merge seguro:
   ```bash
   git fetch origin
   git status
   ```
   Verifique que **nenhum** arquivo sensível (`.env`, `.backups/`) aparece listado para commit (`git status` não deve mostrá-los graças ao `.gitignore`).
4. Adicione, faça o commit e envie para a branch `main`:
   ```bash
   git add .
   git commit -m "fix: correcao completa de audio, Oficina 3D Three.js e preparo Android Capacitor"
   git push -u origin main
   ```
   *(Obs.: Se houver divergência com commits antigos do GitHub que você deseja substituir pela versão atual corrigida do AI Studio, faça um backup da branch atual antes no GitHub e só use `git push --force-with-lease origin main` se tiver certeza de que deseja substituir o estado remoto antigo.)*

### 8.2. Gerar e Baixar o APK Instalável via GitHub Actions
1. Acesse seu repositório no GitHub: **`https://github.com/romulomarianoseverino-bit/Legado-dos-Imortais-`**.
2. Clique na aba **Actions** no menu superior.
3. No painel esquerdo, selecione o workflow **`Build Android APK (Legado dos Imortais)`**.
4. Clique em **`Run workflow`** (branch **`main`**) -> confirmar **`Run workflow`**.
5. Aguarde a conclusão da execução (ícone verde ✅ — normalmente entre 3 e 6 minutos).
6. Entre na execução concluída, role até a seção **Artifacts** no rodapé e baixe **`legado-dos-imortais-debug-apk`**.
7. Descompacte o `.zip` baixado no celular Android ou PC, transfira o arquivo **`app-debug.apk`** para o Android, habilite *"Instalar apps de fontes desconhecidas"* caso solicitado pelo sistema e conclua a instalação para testes pessoais.
