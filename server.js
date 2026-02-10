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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

const getCampaignsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], metaToken, accountId = '921993772267921' } = req.body;

    const now = Date.now();
    const cacheKey = `${accountId}_campaigns`;
    
    let campaigns = [];
    if (getCampaignsCache.has(cacheKey)) {
      const cached = getCampaignsCache.get(cacheKey);
      if (now - cached.timestamp < CACHE_TTL) {
        campaigns = cached.data;
      }
    }

    const systemPrompt = `Voce e um agente de marketing digital, especializado em Meta Ads (Facebook/Instagram).

REGRAS IMPORTANTES:
1. Quando o usuario perguntar sobre campanhas, use a funcao getCampaigns.
2. O usuario ja forneceu o token e o ID da conta.
3. ID da conta atual: ${accountId}
4. NAO peça token novamente se o usuario ja mencionar que esta conectado.
5. Responda de forma direta e objetiva, sem frases desnecessarias.
6. Se o usuario disser que ja colou o token, use imediatamente a funcao getCampaigns.

Se precisar de dados que nao estao na resposta getCampaigns, entao peça claramente.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8),
      { role: 'user', content: message }
    ];

    const tools = [{
      type: 'function',
      function: {
        name: 'getCampaigns',
        description: 'Busca campanhas ativas da conta Meta Ads usando o ID da conta',
        parameters: {
          type: 'object',
          properties: {
            meta_token: {
              type: 'string',
              description: 'Token de acesso da Meta Ads API'
            },
            account_id: {
              type: 'string',
              description: 'ID da conta de anúncios (ex: act_123456789)'
            }
          },
          required: ['meta_token', 'account_id']
        }
      }
    }];

    const response = await axios.post(
      `${GLM_API_URL}/chat/completions`,
      {
        model: 'glm-4.7',
        messages: messages,
        tools: tools
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GLM_API_KEY}`
        },
        timeout: 60000
      }
    );

    const reply = response.data.choices[0].message;

    if (reply.tool_calls) {
      for (const toolCall of reply.tool_calls) {
        if (toolCall.function.name === 'getCampaigns') {
          const args = JSON.parse(toolCall.function.arguments);
          const campaignsResult = await getCampaigns(args.meta_token, args.account_id);

          getCampaignsCache.set(cacheKey, {
            data: campaignsResult,
            timestamp: now
          });

          const functionResponse = await axios.post(
            `${GLM_API_URL}/chat/completions`,
            {
              model: 'glm-4.7',
              messages: [
                { role: 'system', content: systemPrompt },
                ...messages.slice(-8),
                {
                  role: 'tool',
                  content: JSON.stringify(campaignsResult),
                  tool_call_id: toolCall.id
                }
              ]
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GLM_API_KEY}`
              },
              timeout: 60000
            }
          );

          const finalReply = functionResponse.data.choices[0].message.content;

          res.json({
            success: true,
            reply: finalReply,
            campaigns: campaignsResult
          });
          return;
        }
      }
    }

    res.json({
      success: true,
      reply: reply.content
    });
  } catch (error) {
    console.error('Erro ao chamar GLM-4.7:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar sua mensagem. Tente novamente.'
    });
  }
});

async function getCampaigns(metaToken, accountId) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v19.0/${accountId}/campaigns`,
      {
        params: {
          access_token: metaToken,
          fields: 'id,name,status,daily_budget,lifetime_budget,objective,created_time,start_time,stop_time,insights{impressions,clicks,spend}',
          effective_status: ['ACTIVE', 'PAUSED'],
          limit: 25
        },
        timeout: 10000
      }
    );

    const campaigns = response.data.data || [];

    return campaigns.map(c => ({
      id: c.id,
      name: c.name,
      status: c.effective_status[0],
      budget: {
        daily: c.daily_budget,
        lifetime: c.lifetime_budget
      },
      objective: c.objective,
      created: c.created_time,
      started: c.start_time,
      stopped: c.stop_time,
      insights: c.insights ? {
        impressions: c.insights.data?.[0]?.impressions || 0,
        clicks: c.insights.data?.[0]?.clicks || 0,
        spend: c.insights.data?.[0]?.spend || 0
      } : null
    }));
  } catch (error) {
    console.error('Erro ao buscar campanhas:', error.response?.data || error.message);
    return { error: 'Erro ao buscar campanhas. Verifique o token.' };
  }
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`GLM-4.7 API configurada`);
});