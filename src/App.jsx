import { useState, useEffect } from 'react'

function App() {
  const [metaToken, setMetaToken] = useState('')
  const [connected, setConnected] = useState(false)
  const [campaigns, setCampaigns] = useState([])
  const [accountId, setAccountId] = useState('921993772267921')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const savedToken = localStorage.getItem('meta_token')
    const savedConnected = localStorage.getItem('meta_connected')
    const savedAccountId = localStorage.getItem('meta_account_id')

    if (savedToken) {
      setMetaToken(savedToken)
    }
    if (savedConnected === 'true') {
      setConnected(true)
    }
    if (savedAccountId) {
      setAccountId(savedAccountId)
    }
  }, [])

  const connectAds = () => {
    if (!metaToken.trim()) {
      alert('Por favor, cole seu token de acesso.')
      return
    }

    localStorage.setItem('meta_token', metaToken)
    localStorage.setItem('meta_connected', 'true')
    localStorage.setItem('meta_account_id', accountId)

    setConnected(true)
    setMessages([
      ...messages,
      { role: 'assistant', content: 'Token conectado! ID da conta: ' + accountId + '. Agora posso acessar suas campanhas do Meta Ads. Pergunte sobre suas campanhas ativas!' }
    ])
  }

  const disconnectAds = () => {
    localStorage.removeItem('meta_token')
    localStorage.removeItem('meta_connected')
    setConnected(false)
    setCampaigns([])
    setMessages([
      ...messages,
      { role: 'assistant', content: 'Desconectado. Cole o token novamente quando quiser usar.' }
    ])
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = { role: 'user', content: input }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          history: newMessages.slice(-10),
          metaToken: connected ? metaToken : null,
          accountId: connected ? accountId : null
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }])
        if (data.campaigns && !data.campaigns.error) {
          setCampaigns(data.campaigns)
        }
      } else {
        setMessages([...newMessages, { role: 'assistant', content: 'Desculpe, tive um erro. Tente novamente.' }])
      }
    } catch (error) {
      console.error('Erro:', error)
      setMessages([...newMessages, { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📢 Meta Ads Agente</h1>
        <p style={styles.subtitle}>Agente GLM-4.7 integrado com Meta Ads (Facebook/Instagram)</p>
      </div>

      <div style={styles.tokenSection}>
        <label style={styles.label}>Token de Acesso Meta Ads</label>
        <div style={styles.tokenInputContainer}>
          <input
            type="password"
            style={styles.tokenInput}
            value={metaToken}
            onChange={(e) => setMetaToken(e.target.value)}
            placeholder="Cole seu token aqui..."
            disabled={connected}
          />
          <button
            onClick={connected ? disconnectAds : connectAds}
            style={{ ...styles.button, ...(connected ? styles.buttonConnected : {}) }}
          >
            {connected ? 'Desconectar' : 'Conectar'}
          </button>
        </div>
        <p style={styles.hint}>
          💡 Cole seu token e clique em "Conectar" todos os dias. O agente vai usar o token atual.
        </p>
        <label style={styles.label}>ID da Conta de Anúncios (ex: act_123456789)</label>
        <input
          type="text"
          style={styles.accountInput}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="act_123456789"
          disabled={connected}
        />
      </div>

      {connected && campaigns.length > 0 && (
        <div style={styles.campaignsSection}>
          <h2 style={styles.campaignsTitle}>📊 Campanhas Ativas ({campaigns.length})</h2>
          <div style={styles.campaignsList}>
            {campaigns.map((campaign, index) => (
              <div key={index} style={styles.campaignCard}>
                <div style={styles.campaignHeader}>
                  <span style={styles.campaignName}>{campaign.name}</span>
                  <span style={{ ...styles.status, ...getStatusStyle(campaign.status) }}>
                    {campaign.status}
                  </span>
                </div>
                <div style={styles.campaignDetails}>
                  <div style={styles.detailRow}>
                    <span>🎯 Objetivo:</span>
                    <span style={styles.detailValue}>{campaign.objective}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span>💰 Orçamento Diário:</span>
                    <span style={styles.detailValue}>R$ {parseFloat(campaign.budget.daily || 0).toFixed(2)}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span>💸 Gasto:</span>
                    <span style={styles.detailValue}>R$ {parseFloat(campaign.insights?.spend || 0).toFixed(2)}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span>👁 Impressões:</span>
                    <span style={styles.detailValue}>{campaign.insights?.impressions || 0}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span>🖱 Cliques:</span>
                    <span style={styles.detailValue}>{campaign.insights?.clicks || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={styles.chatContainer}>
        {messages.slice(-15).map((msg, index) => (
          <div key={index} style={msg.role === 'user' ? styles.userMessage : styles.assistantMessage}>
            <div style={msg.role === 'user' ? styles.userBubble : styles.assistantBubble}>
              <div style={styles.messageRole}>{msg.role === 'user' ? 'Você' : 'Agente'}</div>
              <div style={styles.messageText}>{msg.content}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={styles.assistantMessage}>
            <div style={styles.assistantBubble}>
              <div style={styles.messageRole}>Agente</div>
              <div style={styles.loading}>Consultando Meta Ads...</div>
            </div>
          </div>
        )}
      </div>

      <div style={styles.inputContainer}>
        <textarea
          style={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={connected ? "Pergunte sobre suas campanhas..." : "Conecte primeiro colando o token acima"}
          rows={2}
          disabled={!connected}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim() || !connected}
          style={{ ...styles.button, ...(loading || !input.trim() || !connected ? styles.buttonDisabled : {}) }}
        >
          {loading ? '...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}

function getStatusStyle(status) {
  const styles = {
    ACTIVE: { background: '#10b981' },
    PAUSED: { background: '#f59e0b' },
    ARCHIVED: { background: '#6b7280' }
  }
  return styles[status] || { background: '#6b7280' }
}

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
  },
  header: {
    textAlign: 'center',
    marginBottom: '25px',
    padding: '25px 20px',
    background: 'linear-gradient(135deg, #1877f2 0%, #42378f 100%)',
    borderRadius: '12px',
    color: 'white',
    boxShadow: '0 8px 25px rgba(24, 119, 242, 0.25)'
  },
  title: {
    fontSize: '1.75rem',
    marginBottom: '8px',
    fontWeight: 700
  },
  subtitle: {
    fontSize: '0.95rem',
    opacity: 0.95
  },
  tokenSection: {
    background: '#fff',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    border: '2px solid #1877f2'
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#333'
  },
  tokenInputContainer: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '15px'
  },
  tokenInput: {
    flex: 1,
    padding: '10px 12px',
    border: '2px solid #e0e0e0',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  accountInput: {
    width: '100%',
    padding: '10px 12px',
    border: '2px solid #e0e0e0',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    marginTop: '5px'
  },
  hint: {
    fontSize: '0.8rem',
    color: '#666',
    marginBottom: '12px'
  },
  button: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #1877f2 0%, #42378f 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.15s',
    whiteSpace: 'nowrap'
  },
  buttonConnected: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  campaignsSection: {
    background: '#fff',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  campaignsTitle: {
    fontSize: '1.15rem',
    fontWeight: 700,
    marginBottom: '15px',
    color: '#333'
  },
  campaignsList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px'
  },
  campaignCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    overflow: 'hidden',
    transition: 'transform 0.2s'
  },
  campaignHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: '#f8f9fa',
    borderBottom: '1px solid #e0e0e0'
  },
  campaignName: {
    fontWeight: 600,
    color: '#333',
    fontSize: '0.95rem'
  },
  status: {
    padding: '4px 10px',
    borderRadius: '15px',
    color: 'white',
    fontSize: '0.75rem',
    fontWeight: 600
  },
  campaignDetails: {
    padding: '12px'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    fontSize: '0.85rem',
    color: '#666',
    borderBottom: '1px solid #f0f0f0'
  },
  detailValue: {
    fontWeight: 600,
    color: '#1877f2'
  },
  chatContainer: {
    minHeight: '350px',
    marginBottom: '15px',
    padding: '15px',
    background: '#f8f9fa',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  userMessage: {
    display: 'flex',
    justifyContent: 'flex-end'
  },
  assistantMessage: {
    display: 'flex',
    justifyContent: 'flex-start'
  },
  userBubble: {
    background: '#1877f2',
    color: 'white',
    padding: '12px 16px',
    borderRadius: '12px 12px 0 12px',
    maxWidth: '75%',
    wordWrap: 'break-word'
  },
  assistantBubble: {
    background: 'white',
    color: '#333',
    padding: '12px 16px',
    borderRadius: '12px 12px 12px 0',
    maxWidth: '75%',
    wordWrap: 'break-word',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
  },
  messageRole: {
    fontSize: '0.7rem',
    marginBottom: '4px',
    opacity: 0.7,
    fontWeight: 600
  },
  messageText: {
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    fontSize: '0.9rem'
  },
  loading: {
    color: '#666',
    fontStyle: 'italic',
    fontSize: '0.85rem'
  },
  inputContainer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end'
  },
  textarea: {
    flex: 1,
    padding: '12px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontFamily: 'Inter, sans-serif',
    resize: 'vertical',
    outline: 'none',
    transition: 'border-color 0.2s'
  }
}

export default App