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

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], metaToken } = req.body;

    const messages = [
      {
        role: 'system',
        content: 'Voce e um agente de marketing digital, especializado em Meta Ads (Facebook/Instagram). Quando o usuario pedir informacoes sobre campanhas, use a funcao getCampaigns. Responda de forma clara e objetiva.'
      },
      ...history,
      {
        role: 'user',
        content: message
      }
    ];

    const tools = [{
      type: 'function',
      function: {
        name: 'getCampaigns',
        description: 'Busca campanhas ativas da conta Meta Ads',
        parameters: {
          type: 'object',
          properties: {
            meta_token: {
              type: 'string',
              description: 'Token de acesso da Meta Ads API'
            }
          },
          required: ['meta_token']
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
        }
      }
    );

    const reply = response.data.choices[0].message;

    if (reply.tool_calls) {
      for (const toolCall of reply.tool_calls) {
        if (toolCall.function.name === 'getCampaigns') {
          const args = JSON.parse(toolCall.function.arguments);
          const campaigns = await getCampaigns(args.meta_token);

          const functionResponse = await axios.post(
            `${GLM_API_URL}/chat/completions`,
            {
              model: 'glm-4.7',
              messages: [
                ...messages,
                {
                  role: 'tool',
                  content: JSON.stringify(campaigns),
                  tool_call_id: toolCall.id
                }
              ]
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GLM_API_KEY}`
              }
            }
          );

          const finalReply = functionResponse.data.choices[0].message.content;

          res.json({
            success: true,
            reply: finalReply,
            campaigns: campaigns
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

async function getCampaigns(metaToken) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v19.0/act_921993772267921/campaigns`,
      {
        params: {
          access_token: metaToken,
          fields: 'id,name,status,daily_budget,lifetime_budget,objective,created_time,start_time,stop_time,insights{impressions,clicks,spend}',
          effective_status: ['ACTIVE', 'PAUSED']
        }
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