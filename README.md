# Calculadora Imóvel em Dólar

Calculadora de financiamento imobiliário nos EUA (estilo Zillow), em PT/EN/ES, com PWA instalável, APK Android e captura de leads. Live em **https://calc.imovelemdolar.com.br**.

## Stack
- Frontend: React 18 + esbuild (bundle único), CSS próprio com a paleta da marca (LP-V4)
- Backend: Express + SQLite nativo do Node 24 (`node:sqlite`) — auth (scrypt + token HMAC) e leads
- Deploy: container único na VPS 82 (Docker Swarm + Traefik + Let's Encrypt)

## Desenvolvimento
```bash
npm install
node build.mjs        # gera dist/
node server.mjs       # http://localhost:3000 (PORT=xxxx pra trocar)
```

## Deploy automatizado
```bash
tar --exclude=node_modules --exclude=dist --exclude=data --exclude=twa -czf /tmp/imovel_calc.tgz .
scp /tmp/imovel_calc.tgz root@82.25.86.82:/tmp/
ssh root@82.25.86.82 "tar -xzf /tmp/imovel_calc.tgz -C /opt/imovel_calc && cd /opt/imovel_calc && docker build -t imovel_calc:latest . && docker service update --force imovel_calc_calc"
```
Segredos (`AUTH_SECRET`, `ADMIN_KEY`) em `/opt/imovel_calc/.env.secrets` na VPS.

## Leads
`GET https://calc.imovelemdolar.com.br/api/leads?key=<ADMIN_KEY>` → JSON com nome, e-mail, WhatsApp e data de cada cadastro do app.

## Login
Só é exigido no modo app instalado (PWA standalone / APK). A web fica aberta. Auto-cadastro: nome, e-mail, WhatsApp, senha.

## APK (TWA)
Gerado com Bubblewrap em `twa/` (keystore `twa/android.keystore`, alias `iedcalc`). O APK publicado fica em `public/app/imovel-em-dolar-calc.apk` e o `assetlinks.json` em `public/.well-known/`. Pra atualizar versão:
```bash
cd twa && bubblewrap update && bubblewrap build
```

## Taxas pré-fixadas
`src/app.jsx` → `PROGRAMS` (fonte: Freddie Mac PMMS, mesma base do Zillow). Atualize os números quando quiser.

## Contato do CTA
`src/app.jsx` → `CTA_URL` (hoje aponta pro site; troque por `https://wa.me/1...` quando definir o número).
