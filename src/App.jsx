import { useState } from 'react'

function App() {
  const [metaToken, setMetaToken] = useState('')
  const [connected, setConnected] = useState(false)
  const [campaigns, setCampaigns] = useState([])
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Olá! Sou o agente de Meta Ads. Cole seu token de acesso no campo acima e clique em "Conectar" pra começar.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const connectAds = () => {
    if (!metaToken.trim()) {
      alert('Por favor, cole seu token de acesso.')
      return
    }

    setConnected(true)
    setMessages([
      ...messages,
      { role: 'assistant', content: 'Token conectado! Agora posso acessar suas campanhas do Meta Ads. Pergunte sobre suas campanhas ativas!' }
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
          history: newMessages.slice(1),
          metaToken: connected ? metaToken : null
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
            onClick={connected ? () => { setConnected(false); setCampaigns([]) } : connectAds}
            style={{ ...styles.button, ...(connected ? styles.buttonConnected : {}) }}
          >
            {connected ? 'Desconectar' : 'Conectar'}
          </button>
        </div>
        <p style={styles.hint}>
          💡 Cole seu token e clique em "Conectar" todos os dias. O agente vai usar o token atual.
        </p>
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
                    <span style={styles.detailValue}>R$ {parseFloat(campaign.budget.daily).toFixed(2)}</span>
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
        {messages.map((msg, index) => (
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
          rows={3}
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
    marginBottom: '30px',
    padding: '30px 20px',
    background: 'linear-gradient(135deg, #1877f2 0%, #42378f 100%)',
    borderRadius: '15px',
    color: 'white',
    boxShadow: '0 10px 30px rgba(24, 119, 242, 0.3)'
  },
  title: {
    fontSize: '2rem',
    marginBottom: '10px',
    fontWeight: 700
  },
  subtitle: {
    fontSize: '1rem',
    opacity: 0.95
  },
  tokenSection: {
    background: '#fff',
    padding: '25px',
    borderRadius: '12px',
    marginBottom: '25px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    border: '2px solid #1877f2'
  },
  label: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: 600,
    marginBottom: '10px',
    color: '#333'
  },
  tokenInputContainer: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  tokenInput: {
    flex: 1,
    padding: '12px 15px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    transition: 'border-color 0.3s'
  },
  hint: {
    fontSize: '0.85rem',
    color: '#666',
    marginTop: '10px',
    fontStyle: 'italic'
  },
  button: {
    padding: '12px 25px',
    background: 'linear-gradient(135deg, #1877f2 0%, #42378f 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
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
    padding: '25px',
    borderRadius: '12px',
    marginBottom: '25px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
  },
  campaignsTitle: {
    fontSize: '1.3rem',
    fontWeight: 700,
    marginBottom: '20px',
    color: '#333'
  },
  campaignsList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '15px'
  },
  campaignCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    overflow: 'hidden'
  },
  campaignHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    background: '#f8f9fa',
    borderBottom: '1px solid #e0e0e0'
  },
  campaignName: {
    fontWeight: 600,
    color: '#333',
    fontSize: '1rem'
  },
  status: {
    padding: '5px 12px',
    borderRadius: '20px',
    color: 'white',
    fontSize: '0.8rem',
    fontWeight: 600
  },
  campaignDetails: {
    padding: '15px'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    fontSize: '0.9rem',
    color: '#666',
    borderBottom: '1px solid #f0f0f0'
  },
  detailValue: {
    fontWeight: 600,
    color: '#1877f2'
  },
  chatContainer: {
    minHeight: '400px',
    marginBottom: '20px',
    padding: '20px',
    background: '#f8f9fa',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
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
    padding: '15px 20px',
    borderRadius: '15px 15px 0 15px',
    maxWidth: '70%',
    wordWrap: 'break-word'
  },
  assistantBubble: {
    background: 'white',
    color: '#333',
    padding: '15px 20px',
    borderRadius: '15px 15px 15px 0',
    maxWidth: '70%',
    wordWrap: 'break-word',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
  },
  messageRole: {
    fontSize: '0.75rem',
    marginBottom: '5px',
    opacity: 0.7,
    fontWeight: 600
  },
  messageText: {
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap'
  },
  loading: {
    color: '#999',
    fontStyle: 'italic'
  },
  inputContainer: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end'
  },
  textarea: {
    flex: 1,
    padding: '15px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    fontSize: '1rem',
    fontFamily: 'Inter, sans-serif',
    resize: 'vertical',
    outline: 'none',
    transition: 'border-color 0.3s'
  }
}

export default App