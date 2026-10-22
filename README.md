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

## Deploy (Render, plano gratuito)

1. Suba o repositório pro GitHub.
2. No [Render](https://render.com): **New > Blueprint**, escolha o repositório. O `render.yaml` já configura tudo.
3. Preencha `CLOUDFLARE_TURN_KEY_ID` e `CLOUDFLARE_TURN_API_TOKEN` quando o Render pedir.

O plano gratuito "dorme" depois de 15 minutos sem uso; o primeiro acesso depois disso demora ~1 minuto.

## TURN (Cloudflare)

Sem TURN, a conexão direta falha em algumas redes (CGNAT, 4G). Para criar as chaves:
painel do Cloudflare > **Realtime** > **TURN Server** > criar, e copiar o *Turn Token ID* e o *API Token*.
O plano gratuito cobre 1.000 GB/mês de retransmissão.
