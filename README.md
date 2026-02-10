# 📢 Meta Ads Agente com GLM-4.7

> Agente inteligente integrado com Meta Ads (Facebook/Instagram)

---

## 📋 O que faz

- **Campo de Token:** Cola seu token do Meta Ads diariamente
- **Agente GLM-4.7:** Conversa em português
- **Acesso às Campanhas:** Busca campanhas ativas automaticamente
- **Dashboard Visual:** Veja orçamento, gasto, impressões, cliques

---

## 🚀 Como usar

### Desenvolvimento local
```bash
npm install
npm run dev
```

### Deploy na VPS
```bash
# Buildar imagem
docker build -t meta-ads-agente:latest .

# Deploy no Swarm
docker stack deploy -c docker-compose-stack.yml meta-ads-agente
```

---

## 🔧 Configurações

**GLM-4.7 API:**
```env
GLM_API_KEY=3426673eebda4070a78bf8bbbf53509d.m87S46cq1QO6P8Qj
GLM_API_URL=https://api.z.ai/api/coding/paas/v4
```

**Meta Ads:**
- Cole o token na interface
- Clique em "Conectar"
- Agente usa o token na hora da consulta

---

## 🌐 Acesso

- **Dev:** http://localhost:5173
- **Produção:** http://85.209.92.152:8890
- **DNS:** https://meta-ads.insn.online (pendente)

---

## 📦 Tecnologias

- React 18
- Vite 5
- Node.js 18
- Meta Ads API (Graph API)
- GLM-4.7 (Agente inteligente)
- Docker Swarm
- Traefik (SSL automático)

---

## 💡 Como Funciona

1. Você cola o token do Meta Ads
2. Clica em "Conectar"
3. Pergunta sobre campanhas pro agente
4. Agente busca na API do Meta Ads
5. Mostra os dados no dashboard

---

## 🔒 Segurança

- Token armazenado apenas na sessão do navegador
- Não enviado pra nenhum banco de dados
- Token usado apenas durante a consulta

---

## 📊 Informações Exibidas

Por campanha:
- Nome
- Status (ACTIVE/PAUSED/ARCHIVED)
- Objetivo
- Orçamento diário
- Gasto atual
- Impressões
- Cliques