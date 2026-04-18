import React, { useState, useRef, useEffect } from 'react'
import { API_BASE } from '../config'

const WELCOME = `Hello! I'm your AI trading assistant, trained on the ICT + ICC methodology.

I have access to your TradingView charts in real time. Ask me anything:
• "Should I take this trade?" — I'll pull the current chart and analyze it
• "What's the current GBPUSD setup?"
• "Explain order blocks to me"
• "Grade my last trade"
• "What's the bias for today?"

I know your system, your pairs (GBPUSD, GBPJPY, EURUSD), and your strategy (ICC Kill Zone method). Let's work.`

export default function Assistant() {
  const [messages, setMessages] = useState([{ role: 'ai', content: WELCOME }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(m => [...m, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: messages.slice(-10) })
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'ai', content: data.reply || 'Sorry, I could not process that.' }])
    } catch {
      setMessages(m => [...m, { role: 'ai', content: '⚠️ Backend not connected. Start the Python backend to enable AI chat. (Run `./start.sh` from the trading-academy folder)' }])
    }
    setLoading(false)
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  const QUICK = [
    'What\'s the current GBPUSD setup?',
    'Is there a Kill Zone active right now?',
    'Analyze GBPJPY for me',
    'Explain Fair Value Gaps',
    'What should my bias be today?',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface)' }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>AI Trading Assistant</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: 16 }}>Connected to TradingView • ICT + ICC methodology • Real-time chart analysis</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 800, width: '100%', margin: '0 auto', alignSelf: 'stretch' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'ai' && (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gold-glow)', border: '1px solid var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0, marginTop: 4, fontSize: '0.9rem' }}>🤖</div>
            )}
            <div className={`chat-bubble ${msg.role}`} style={{ whiteSpace: 'pre-wrap', maxWidth: '75%' }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gold-glow)', border: '1px solid var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>🤖</div>
            <div className="chat-bubble ai" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} />
              <span className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} />
              <span className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div style={{ padding: '0 24px 12px', maxWidth: 800, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {QUICK.map(q => (
            <button key={q} className="btn btn-secondary btn-sm" style={{ fontSize: '0.78rem' }} onClick={() => { setInput(q); setTimeout(send, 10) }}>
              {q}
            </button>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface)', padding: '16px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', gap: 10 }}>
          <textarea
            className="chat-input"
            rows={2}
            placeholder="Ask anything about your charts, setups, or trading concepts..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            style={{ resize: 'none' }}
          />
          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={send} disabled={loading || !input.trim()}>
            Send
          </button>
        </div>
        <div style={{ maxWidth: 800, margin: '6px auto 0', fontSize: '0.72rem', color: 'var(--text-3)' }}>
          Press Enter to send • Shift+Enter for new line
        </div>
      </div>
    </div>
  )
}
