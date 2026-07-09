# Calculadora Imóvel em Dólar — Design aprovado (2026-07-09)

## Objetivo
Calculadora de financiamento imobiliário estilo Zillow (zillow.com/mortgage-calculator), com a marca Imóvel em Dólar e o Marcos "Marcão" Fernandes, em calc.imovelemdolar.com.br, com app instalável (PWA + APK) e login com auto-cadastro que gera leads.

## Decisões (aprovadas pelo Marcio)
- **App mobile:** PWA + APK real gerado via Bubblewrap/PWABuilder (TWA), download no próprio site; iPhone usa PWA.
- **Login:** só no modo app instalado (standalone). Web aberta.
- **Cadastro:** auto-cadastro (nome, e-mail, WhatsApp, senha) → base de leads.
- **Auth/leads:** auto-contido na VPS (API Node + SQLite via node:sqlite no mesmo container). Sem Supabase por ora — não há token de gestão pra criar projeto novo sem bloquear; migração futura é simples.

## Stack
- Frontend: React 18 + esbuild (mesmo padrão da LP-V4), CSS próprio com a paleta da marca. Sem Tailwind/libs de chart (donut em SVG puro).
- Backend: Express mínimo servindo estático + `/api` (register/login/leads), SQLite nativo do Node 24 (`node:sqlite`), senha com scrypt, token HMAC.
- Deploy: container único (node:24-alpine) na VPS 82, Docker Swarm + Traefik + Let's Encrypt (padrão dos stacks existentes). DNS via API Cloudflare (zona imovelemdolar.com.br).

## Calculadora (paridade Zillow)
Preço do imóvel, entrada ($ e % sincronizados), programa (30/20/15/10 anos fixo, FHA 30, VA 30), taxa de juros pré-preenchida por programa e editável, property tax (%), seguro residencial ($/mês), HOA ($/mês), PMI automático quando entrada < 20% (0,5%/ano, removível). Saída: parcela mensal em destaque, donut de composição (P&I, impostos, seguro, PMI, HOA), tabela de amortização anual expansível, total de juros.

**Taxas pré-fixadas** (Freddie Mac PMMS 02/07/2026, mesma base do Zillow):
30 anos 6,43% · 20 anos 6,25% · 15 anos 5,79% · 10 anos 5,65% · FHA 30 6,00% · VA 30 5,95%.

## Idiomas
PT-BR (padrão), EN, ES — dicionário JSON próprio, seletor no header. Moeda sempre USD.

## Identidade visual
Paleta LP-V4: laranja ação #FF9D00, azul royal #3232CA, azul escuro #02026B, fundo azul-bebê #EEF7FE. Fontes Poppins (títulos) / Manrope (corpo). Logo colorido no header, foto do Marcão no hero, CTA para imovelemdolar.com.br (WhatsApp como constante configurável — número não definido nos materiais).

## Fases
1. Calculadora web no ar em calc.imovelemdolar.com.br
2. PWA + login no modo app (leads em SQLite, volume persistente)
3. APK gerado (TWA) + assetlinks.json + botão de download com instruções
