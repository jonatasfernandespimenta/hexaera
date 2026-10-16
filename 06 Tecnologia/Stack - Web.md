---
tags: [tecnologia]
status: decidido
---
# Stack — Web (WebGL)

**Decisão (2026-10-16):** jogo **web** com WebGL, no lugar de Godot + Blender.

## Stack
| Camada | Escolha |
|---|---|
| Linguagem | **TypeScript** |
| Build | **Vite** |
| 3D (mesa, tiles, miniaturas) | **Three.js** via **React Three Fiber** + drei |
| UI (barra de recursos, cartas, eventos) | **HTML/CSS** sobre o canvas (React), fonte pixel |
| Regras | **TypeScript puro**, sem dependência de render |
| Testes de regras | **Vitest** (headless, rápido) |
| Miniaturas voxel | geradas **por código** (voxels → `InstancedMesh`) no início; MagicaVoxel → `.glb` se precisar de mais detalhe |
| PC (Steam) | wrapper **Tauri** (ou Electron) |
| Mobile | **Capacitor** (iOS/Android) ou PWA |

## Por que web
- Roda no navegador: **link pra testar** e mostrar pros amigos, sem instalar nada.
- UI cheia de cartas, painéis e texto é muito mais fácil em **HTML/CSS** do que em engine.
- TypeScript é o terreno mais forte para **vibe coding**.
- Regras em TS puro + Vitest = testes headless triviais.
- Dá pra eu **ver o jogo rodando** via automação do Chrome (screenshots) — o MCP do Godot não mostrava a tela.
- O mesmo arquivo de dados de construções pode gerar as **cartas físicas** (HTML → PDF) para o [[Modo Tabuleiro]].

## Riscos / custos
- Sem editor visual de cena: posicionamento e iluminação são feitos em código.
- Performance no **mobile**: limitar sombras, usar `InstancedMesh` para árvores/voxels, cuidado com pós-processamento.
- Steam e lojas mobile exigem wrapper (Tauri/Capacitor) — funciona, mas é uma etapa a mais.

## Histórico
Antes: Godot 4 + GDScript + Blender. Trocado por web pelo fluxo de UI, testes e iteração visual mais simples.
