import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const GLM_API_KEY = process.env.GLM_API_KEY || '3426673eebda4070a78bf8bbbf53509d.m87S46cq1QO6P8Qj';
const GLM_API_URL = process.env.GLM_API_URL || 'https://api.z.ai/api/coding/paas/v4';
const META_API = 'https://graph.facebook.com/v19.0';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// ============================================
// HELPERS META ADS API
// ============================================

function ensureActPrefix(id) {
  if (!id) return id;
  return id.startsWith('act_') ? id : `act_${id}`;
}

async function fetchMeta(endpoint, token, params = {}) {
  try {
    const res = await axios.get(`${META_API}/${endpoint}`, {
      params: { access_token: token, ...params },
      timeout: 15000,
    });
    return { success: true, data: res.data.data || res.data };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error(`Meta API error [${endpoint}]:`, msg);
    return { success: false, error: msg };
  }
}

// ============================================
// META ADS ENDPOINTS (dados diretos, sem IA)
// ============================================

// Listar campanhas
app.get('/api/meta/campaigns', async (req, res) => {
  const { token, account_id } = req.query;
  if (!token || !account_id) return res.status(400).json({ error: 'Token e account_id são obrigatórios' });

  const acctId = ensureActPrefix(account_id);
  const result = await fetchMeta(`${acctId}/campaigns`, token, {
    fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time',
    limit: 50,
  });

  if (!result.success) return res.status(400).json({ error: result.error });

  const campaigns = (result.data || []).map(c => ({
    id: c.id,
    name: c.name,
    status: c.status,
    objective: c.objective,
    daily_budget: c.daily_budget ? (parseInt(c.daily_budget) / 100).toFixed(2) : null,
    lifetime_budget: c.lifetime_budget ? (parseInt(c.lifetime_budget) / 100).toFixed(2) : null,
    start_time: c.start_time,
    stop_time: c.stop_time,
  }));

  res.json({ campaigns });
});

// Insights de uma campanha
app.get('/api/meta/insights', async (req, res) => {
  const { token, campaign_id, date_preset = 'last_7d' } = req.query;
  if (!token || !campaign_id) return res.status(400).json({ error: 'Token e campaign_id são obrigatórios' });

  const result = await fetchMeta(`${campaign_id}/insights`, token, {
    fields: 'impressions,reach,clicks,ctr,cpc,cpm,spend,actions,cost_per_action_type',
    date_preset,
  });

  if (!result.success) return res.status(400).json({ error: result.error });
  res.json({ insights: result.data });
});

// Insights por faixa etária
app.get('/api/meta/insights/age', async (req, res) => {
  const { token, campaign_id, date_preset = 'last_7d' } = req.query;
  if (!token || !campaign_id) return res.status(400).json({ error: 'Token e campaign_id são obrigatórios' });

  const result = await fetchMeta(`${campaign_id}/insights`, token, {
    fields: 'impressions,reach,clicks,ctr,spend,actions',
    breakdowns: 'age',
    date_preset,
  });

  if (!result.success) return res.status(400).json({ error: result.error });
  res.json({ age_insights: result.data });
});

// Ad sets de uma campanha
app.get('/api/meta/adsets', async (req, res) => {
  const { token, campaign_id } = req.query;
  if (!token || !campaign_id) return res.status(400).json({ error: 'Token e campaign_id são obrigatórios' });

  const result = await fetchMeta(`${campaign_id}/adsets`, token, {
    fields: 'id,name,status,daily_budget,targeting,optimization_goal',
  });

  if (!result.success) return res.status(400).json({ error: result.error });
  res.json({ adsets: result.data });
});

// ============================================
// CHAT - COM STREAMING (SSE)
// ============================================

app.post('/api/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const { message, history = [], metaToken, accountId } = req.body;
    const acctId = ensureActPrefix(accountId);

    // ESTRATÉGIA: buscar dados Meta Ads ANTES de chamar a IA
    // Assim não precisamos de function calling (que é 2x mais lento)
    let metaContext = '';

    if (metaToken && acctId) {
      // Busca dados relevantes baseado na pergunta
      const lowerMsg = message.toLowerCase();
      const wantsCampaigns = /campanha|campaign|ativa|ativas|lista|quais|mostr/i.test(lowerMsg);
      const wantsInsights = /resultado|métrica|gasto|spend|ctr|clique|impressão|performance|desempenho|insight|conversa|retorno|roi/i.test(lowerMsg);
      const wantsAge = /idade|faixa|etári|público|demogra|jovem|velho|45|55|25|18/i.test(lowerMsg);
      const isGeneral = /olá|oi|bom dia|boa tarde|boa noite|como vai|ajuda|help/i.test(lowerMsg);

      if (!isGeneral) {
        // Sempre buscar campanhas para contexto
        const campResult = await fetchMeta(`${acctId}/campaigns`, metaToken, {
          fields: 'id,name,status,objective,daily_budget,start_time',
          limit: 30,
        });

        if (campResult.success && campResult.data?.length > 0) {
          const campaigns = campResult.data.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status,
            objective: c.objective,
            daily_budget_reais: c.daily_budget ? `R$${(parseInt(c.daily_budget) / 100).toFixed(2)}` : 'N/A',
            inicio: c.start_time,
          }));
          metaContext += `\n\n=== CAMPANHAS (${campaigns.length} total) ===\n${JSON.stringify(campaigns, null, 2)}`;

          // Buscar insights da campanha ativa
          const activeCamp = campaigns.find(c => c.status === 'ACTIVE');
          const targetCampId = activeCamp?.id || campaigns[0]?.id;

          if (targetCampId && (wantsInsights || wantsCampaigns)) {
            const insResult = await fetchMeta(`${targetCampId}/insights`, metaToken, {
              fields: 'impressions,reach,clicks,ctr,cpc,cpm,spend,actions,cost_per_action_type',
              date_preset: 'last_7d',
            });
            if (insResult.success && insResult.data?.length > 0) {
              metaContext += `\n\n=== INSIGHTS (últimos 7 dias) da campanha ${activeCamp?.name || campaigns[0]?.name} ===\n${JSON.stringify(insResult.data[0], null, 2)}`;
            }
          }

          if (targetCampId && wantsAge) {
            const ageResult = await fetchMeta(`${targetCampId}/insights`, metaToken, {
              fields: 'impressions,reach,clicks,ctr,spend,actions',
              breakdowns: 'age',
              date_preset: 'last_7d',
            });
            if (ageResult.success && ageResult.data?.length > 0) {
              metaContext += `\n\n=== INSIGHTS POR FAIXA ETÁRIA ===\n${JSON.stringify(ageResult.data, null, 2)}`;
            }
          }
        }
      }
    }

    const systemPrompt = `Você é um especialista em Meta Ads (Facebook/Instagram Ads) da agência NEXUS.
Seu trabalho é analisar campanhas, dar recomendações e interpretar métricas.

REGRAS:
1. Responda SEMPRE em português brasileiro
2. Seja direto e objetivo
3. Use emojis para organizar a informação
4. Quando tiver dados, ANALISE e dê RECOMENDAÇÕES concretas
5. Valores de daily_budget na API vêm em CENTAVOS (2000 = R$20,00)
6. CTR acima de 2% é bom, acima de 3% é excelente
7. Para tatuagem feminina em Piracicaba, custo por conversa abaixo de R$3 é bom
8. Faixas etárias 45-54 e 55-64 costumam ter melhor CTR mas menos volume
9. Se o token não foi configurado, peça pro usuário colar o token na área de configuração acima do chat
10. Quando mostrar dados numéricos, use TABELAS formatadas em markdown

${metaContext ? `\n\nDADOS ATUAIS DA CONTA META ADS:\n${metaContext}` : ''}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8),
      { role: 'user', content: message },
    ];

    const response = await axios.post(
      `${GLM_API_URL}/chat/completions`,
      { model: 'glm-4.7', messages, temperature: 0.4, stream: true },
      {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GLM_API_KEY}` },
        responseType: 'stream',
      }
    );

    response.data.on('data', (chunk) => {
      const text = chunk.toString();
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          res.write(line + '\n');
        }
      }
    });

    response.data.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    response.data.on('error', (err) => {
      console.error('Stream error:', err.message);
      res.write(`data: {"error": "Stream interrompido"}\n\n`);
      res.end();
    });
  } catch (error) {
    console.error('Chat stream error:', error.message);
    res.write(`data: {"error": "${error.message}"}\n\n`);
    res.end();
  }
});

// Chat fallback (sem streaming)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const messages = [
      { role: 'system', content: 'Você é um especialista em Meta Ads. Responda em português.' },
      ...history.slice(-6),
      { role: 'user', content: message },
    ];
    const response = await axios.post(
      `${GLM_API_URL}/chat/completions`,
      { model: 'glm-4.7', messages, temperature: 0.4 },
      { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GLM_API_KEY}` } }
    );
    res.json({ success: true, reply: response.data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Meta Ads Agente rodando na porta ${PORT}`);
  console.log(`🤖 GLM-4.7 API configurada`);
  console.log(`📊 Meta Ads API: ${META_API}`);
});