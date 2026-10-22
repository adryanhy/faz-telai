# Faz telai 📺

Compartilhamento de tela entre amigos, direto no navegador. P2P via WebRTC, com um servidor Node só pra salas e sinalização.

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em http://localhost:5173 (o Vite faz proxy do Socket.io para o servidor Node na porta 3001).

Para testar com TURN localmente, copie `.env.example` para `.env` e preencha as chaves do Cloudflare.

## Estrutura

- `shared/` – tipos e validações usados pelo cliente e pelo servidor (o "contrato" do Socket.io)
- `server/` – Node + Express + Socket.io: salas, sinalização e credenciais TURN
- `client/` – React + Vite

## Scripts

- `npm run dev` – servidor e cliente em modo desenvolvimento
- `npm run typecheck` – checa os tipos dos dois lados
- `npm run build` – gera o site em `client/dist`
- `npm start` – sobe o servidor, que também entrega o site buildado (produção)

## Testes

```bash
npm run check
```

Roda tudo que o pipeline roda, na mesma ordem:

- `npm run typecheck` – tipos do servidor, do cliente e dos testes E2E
- `npm test` – testes unitários e de integração (Vitest). O servidor sobe de verdade numa porta aleatória e os testes conversam com ele pelo Socket.io. `npm run test:watch` roda em modo observação enquanto você programa.
- `npm run test:e2e` – testes de ponta a ponta (Playwright). Sobe o app buildado e abre duas "pessoas" no Chromium, que entram na sala, compartilham e assistem. O seletor de tela não dá pra automatizar, então os testes usam uma tela falsa (canvas animado + tom de áudio); todo o resto roda de verdade. Na primeira vez, instale o navegador com `npx playwright install chromium`.

Onde fica cada teste:

- `shared/src/*.test.ts`, `client/src/lib/*.test.ts`, `server/src/*.test.ts` – unitários e integração, ao lado do código testado
- `e2e/*.spec.ts` – ponta a ponta

### Pipeline (GitHub Actions)

`.github/workflows/ci.yml` roda a checagem completa em todo push na `main` e em todo pull request. O Render só publica uma versão nova depois que o pipeline passa (`autoDeployTrigger: checksPass` no `render.yaml`). Se algum teste falhar, o site continua na versão anterior, e o relatório do Playwright fica salvo nos artefatos da execução.

## Deploy (Render, plano gratuito)

1. Suba o repositório pro GitHub.
2. No [Render](https://render.com): **New > Blueprint**, escolha o repositório. O `render.yaml` já configura tudo.
3. Preencha `CLOUDFLARE_TURN_KEY_ID` e `CLOUDFLARE_TURN_API_TOKEN` quando o Render pedir.

O plano gratuito "dorme" depois de 15 minutos sem uso; o primeiro acesso depois disso demora ~1 minuto.

## TURN (Cloudflare)

Sem TURN, a conexão direta falha em algumas redes (CGNAT, 4G). Para criar as chaves:
painel do Cloudflare > **Realtime** > **TURN Server** > criar, e copiar o *Turn Token ID* e o *API Token*.
O plano gratuito cobre 1.000 GB/mês de retransmissão.
