import { useState, useEffect, useRef } from 'react'

function App() {
  const [metaToken, setMetaToken] = useState('')
  const [accountId, setAccountId] = useState('921993772267921')
  const [connected, setConnected] = useState(false)
  const [campaigns, setCampaigns] = useState([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showConfig, setShowConfig] = useState(true)
  const chatEndRef = useRef(null)

  useEffect(() => {
    const st = localStorage.getItem('meta_token')
    const sc = localStorage.getItem('meta_connected')
    const sa = localStorage.getItem('meta_account_id')
    if (st) setMetaToken(st)
    if (sa) setAccountId(sa)
    if (sc === 'true' && st) {
      setConnected(true)
      setShowConfig(false)
      loadCampaigns(st, sa || '921993772267921')
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const loadCampaigns = async (token, acctId) => {
    setLoadingCampaigns(true)
    try {
      const res = await fetch(`/api/meta/campaigns?token=${encodeURIComponent(token)}&account_id=${acctId}`)
      const data = await res.json()
      if (data.campaigns) setCampaigns(data.campaigns)
    } catch { /* silenciar */ }
    setLoadingCampaigns(false)
  }

  const connectAds = async () => {
    if (!metaToken.trim()) return alert('Cole seu token de acesso')
    localStorage.setItem('meta_token', metaToken)
    localStorage.setItem('meta_connected', 'true')
    localStorage.setItem('meta_account_id', accountId)
    setConnected(true)
    setShowConfig(false)
    setMessages([{ role: 'assistant', content: `✅ Conectado à conta **act_${accountId}**!\n\nAgora posso analisar suas campanhas, métricas e dar recomendações. Pergunte o que quiser!` }])
    await loadCampaigns(metaToken, accountId)
  }

  const disconnectAds = () => {
    localStorage.removeItem('meta_token')
    localStorage.removeItem('meta_connected')
    setConnected(false)
    setCampaigns([])
    setShowConfig(true)
    setMessages([{ role: 'assistant', content: 'Desconectado. Cole um novo token quando quiser.' }])
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setStreaming(true)

    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: updated.slice(-10),
          metaToken: connected ? metaToken : null,
          accountId: connected ? accountId : null,
        }),
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content || ''
              accumulated += delta
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = { role: 'assistant', content: accumulated }
                return copy
              })
            } catch { /* chunk parcial */ }
          }
        }
      }
    } catch {
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: '❌ Erro de conexão. Tente novamente.' }
        return copy
      })
    } finally {
      setStreaming(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE')
  const pausedCampaigns = campaigns.filter(c => c.status === 'PAUSED')

  return (
    <div style={s.page}>
      {/* SIDEBAR */}
      <aside style={s.sidebar}>
        <div style={s.logoArea}>
          <div style={s.logoIcon}>📊</div>
          <div>
            <h1 style={s.brandName}>META ADS</h1>
            <span style={s.brandSub}>Agente</span>
          </div>
        </div>

        {/* Config */}
        <div style={s.configSection}>
          <button onClick={() => setShowConfig(!showConfig)} style={s.configToggle}>
            ⚙️ {showConfig ? 'Esconder Config' : 'Configuração'}
          </button>

          {showConfig && (
            <div style={s.configPanel}>
              <label style={s.label}>Token Meta Ads</label>
              <textarea
                style={s.tokenInput}
                value={metaToken}
                onChange={e => setMetaToken(e.target.value)}
                placeholder="Cole seu token aqui..."
                rows={3}
                disabled={connected}
              />
              <label style={s.label}>Account ID</label>
              <input
                type="text"
                style={s.acctInput}
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                placeholder="921993772267921"
                disabled={connected}
              />
              <button onClick={connected ? disconnectAds : connectAds}
                style={connected ? s.disconnectBtn : s.connectBtn}>
                {connected ? '🔌 Desconectar' : '🔗 Conectar'}
              </button>
            </div>
          )}
        </div>

        {/* Status */}
        <div style={s.statusBox}>
          <div style={{ ...s.statusDot, background: connected ? '#22c55e' : '#ef4444' }} />
          <span style={s.statusText}>{connected ? 'Conectado' : 'Desconectado'}</span>
        </div>

        {/* Campanhas na sidebar */}
        {connected && (
          <div style={s.campsSidebar}>
            <h3 style={s.campsTitle}>Campanhas</h3>
            {loadingCampaigns && <p style={s.campsLoading}>Carregando...</p>}

            {activeCampaigns.length > 0 && (
              <>
                <span style={s.campsBadge}>🟢 Ativas ({activeCampaigns.length})</span>
                {activeCampaigns.map(c => (
                  <div key={c.id} style={s.campItem}>
                    <div style={s.campName}>{c.name}</div>
                    <div style={s.campBudget}>{c.daily_budget ? `R$${c.daily_budget}/dia` : ''}</div>
                  </div>
                ))}
              </>
            )}

            {pausedCampaigns.length > 0 && (
              <>
                <span style={{ ...s.campsBadge, color: '#f59e0b' }}>⏸ Pausadas ({pausedCampaigns.length})</span>
                {pausedCampaigns.slice(0, 5).map(c => (
                  <div key={c.id} style={{ ...s.campItem, opacity: 0.6 }}>
                    <div style={s.campName}>{c.name}</div>
                  </div>
                ))}
                {pausedCampaigns.length > 5 && (
                  <span style={s.campsMore}>+{pausedCampaigns.length - 5} mais</span>
                )}
              </>
            )}
          </div>
        )}

        <div style={s.sidebarFooter}>
          <span>GLM-4.7 · NEXUS</span>
        </div>
      </aside>

      {/* MAIN CHAT */}
      <main style={s.main}>
        <div style={s.chatHeader}>
          <h2 style={s.chatTitle}>🤖 Assistente Meta Ads</h2>
          <span style={s.chatSub}>Análise inteligente de campanhas com IA</span>
        </div>

        <div style={s.chatArea}>
          {messages.length === 0 && (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>📈</div>
              <h3 style={s.emptyTitle}>Pronto para analisar</h3>
              <p style={s.emptyText}>
                {connected
                  ? 'Pergunte sobre suas campanhas, métricas, públicos ou peça recomendações!'
                  : 'Configure seu token Meta Ads no painel à esquerda para começar'}
              </p>
              {connected && (
                <div style={s.quickActions}>
                  {['Quais são minhas campanhas ativas?', 'Qual o desempenho dessa semana?', 'Qual faixa etária converte melhor?'].map((q, i) => (
                    <button key={i} style={s.quickBtn} onClick={() => { setInput(q); }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={msg.role === 'user' ? s.userRow : s.botRow}>
              <div style={msg.role === 'user' ? s.userAvatar : s.botAvatar}>
                {msg.role === 'user' ? '👤' : '🤖'}
              </div>
              <div style={msg.role === 'user' ? s.userBubble : s.botBubble}>
                <div style={s.msgContent}>
                  {formatMessage(msg.content)}
                  {streaming && i === messages.length - 1 && msg.role === 'assistant' ? '▍' : ''}
                </div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div style={s.inputBar}>
          <textarea
            style={s.textarea}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={connected ? 'Pergunte sobre suas campanhas...' : 'Conecte o token primeiro'}
            rows={1}
            disabled={streaming || !connected}
          />
          <button onClick={sendMessage} disabled={streaming || !input.trim() || !connected} style={s.sendBtn}>
            {streaming ? '⏳' : '➤'}
          </button>
        </div>
      </main>
    </div>
  )
}

// Formatador simples de markdown
function formatMessage(text) {
  if (!text) return ''
  // Negrito
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function getStatusColor(status) {
  if (status === 'ACTIVE') return '#22c55e'
  if (status === 'PAUSED') return '#f59e0b'
  return '#64748b'
}

// ============================================
// STYLES (Dark Premium Theme)
// ============================================
const s = {
  page: {
    display: 'flex', height: '100vh', background: '#0f1115',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", color: '#e2e8f0',
  },

  // SIDEBAR
  sidebar: {
    width: '300px', background: '#161820', borderRight: '1px solid #1e2130',
    display: 'flex', flexDirection: 'column', padding: '24px 16px', overflowY: 'auto',
    flexShrink: 0,
  },
  logoArea: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', paddingLeft: '8px' },
  logoIcon: { fontSize: '2rem' },
  brandName: { fontSize: '1.3rem', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.5px' },
  brandSub: { fontSize: '0.7rem', color: '#64748b', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase' },

  configSection: { marginBottom: '20px' },
  configToggle: {
    width: '100%', padding: '10px 14px', background: '#1e2130', border: '1px solid #2d303b',
    borderRadius: '10px', color: '#94a3b8', cursor: 'pointer', textAlign: 'left',
    fontSize: '0.85rem', fontFamily: "'Inter', sans-serif",
  },
  configPanel: {
    marginTop: '12px', padding: '14px', background: '#1a1d28', borderRadius: '10px',
    border: '1px solid #2d303b',
  },
  label: { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px', marginTop: '10px' },
  tokenInput: {
    width: '100%', padding: '10px', background: '#0f1115', border: '1px solid #2d303b',
    borderRadius: '8px', color: '#fff', fontSize: '0.8rem', resize: 'none',
    fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
  },
  acctInput: {
    width: '100%', padding: '10px', background: '#0f1115', border: '1px solid #2d303b',
    borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none',
    fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
  },
  connectBtn: {
    width: '100%', marginTop: '12px', padding: '10px', border: 'none', borderRadius: '8px',
    background: 'linear-gradient(135deg, #1877f2, #42378f)', color: '#fff',
    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },
  disconnectBtn: {
    width: '100%', marginTop: '12px', padding: '10px', border: '1px solid #ef4444',
    borderRadius: '8px', background: 'transparent', color: '#ef4444',
    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  },

  statusBox: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
    background: '#1a1d28', borderRadius: '10px', marginBottom: '20px',
  },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%' },
  statusText: { fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 },

  campsSidebar: { flex: 1, overflowY: 'auto' },
  campsTitle: { fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' },
  campsLoading: { fontSize: '0.8rem', color: '#64748b' },
  campsBadge: { fontSize: '0.75rem', color: '#22c55e', fontWeight: 600, display: 'block', marginBottom: '6px', marginTop: '10px' },
  campItem: {
    padding: '8px 10px', background: '#1a1d28', borderRadius: '8px', marginBottom: '4px',
    border: '1px solid #2d303b',
  },
  campName: { fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  campBudget: { fontSize: '0.7rem', color: '#1877f2', marginTop: '2px' },
  campsMore: { fontSize: '0.75rem', color: '#64748b', paddingLeft: '10px' },

  sidebarFooter: {
    marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #1e2130',
    fontSize: '0.7rem', color: '#475569', textAlign: 'center',
  },

  // MAIN
  main: {
    flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 32px',
    maxWidth: '900px', margin: '0 auto', width: '100%',
  },
  chatHeader: {
    marginBottom: '20px', padding: '20px 24px', background: '#161820',
    borderRadius: '14px', border: '1px solid #1e2130',
  },
  chatTitle: { fontSize: '1.1rem', fontWeight: 600, color: '#fff', margin: 0 },
  chatSub: { fontSize: '0.8rem', color: '#64748b' },

  chatArea: {
    flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px',
    padding: '20px', background: '#161820', borderRadius: '14px', border: '1px solid #1e2130',
    marginBottom: '16px',
  },

  emptyState: { textAlign: 'center', padding: '60px 20px' },
  emptyIcon: { fontSize: '3rem', marginBottom: '16px' },
  emptyTitle: { color: '#fff', fontWeight: 600, fontSize: '1.2rem', marginBottom: '8px' },
  emptyText: { color: '#64748b', fontSize: '0.95rem', maxWidth: '400px', margin: '0 auto', lineHeight: 1.5 },
  quickActions: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px', alignItems: 'center' },
  quickBtn: {
    padding: '10px 18px', background: '#1a1d28', border: '1px solid #2d303b',
    borderRadius: '10px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem',
    fontFamily: "'Inter', sans-serif", transition: 'all 0.15s', maxWidth: '380px', width: '100%',
  },

  userRow: { display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'flex-start' },
  botRow: { display: 'flex', justifyContent: 'flex-start', gap: '10px', alignItems: 'flex-start' },
  userAvatar: {
    width: '32px', height: '32px', borderRadius: '8px', background: '#1877f2', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', order: 1,
  },
  botAvatar: {
    width: '32px', height: '32px', borderRadius: '8px', background: '#1e2130', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem',
  },
  userBubble: {
    background: 'rgba(24,119,242,0.15)', padding: '12px 16px', borderRadius: '14px 14px 2px 14px',
    maxWidth: '75%',
  },
  botBubble: {
    background: '#1e2130', padding: '12px 16px', borderRadius: '14px 14px 14px 2px',
    maxWidth: '80%',
  },
  msgContent: { lineHeight: 1.7, whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#e2e8f0' },

  inputBar: {
    display: 'flex', gap: '10px', alignItems: 'flex-end',
    padding: '12px 16px', background: '#161820', borderRadius: '14px', border: '1px solid #1e2130',
  },
  textarea: {
    flex: 1, padding: '12px 14px', background: '#0f1115', border: '1px solid #1e2130',
    borderRadius: '10px', color: '#fff', fontSize: '0.9rem', resize: 'none',
    fontFamily: "'Inter', sans-serif", maxHeight: '120px', outline: 'none',
  },
  sendBtn: {
    width: '44px', height: '44px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg, #1877f2, #42378f)', color: '#fff',
    fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
  },
}

export default App