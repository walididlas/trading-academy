import React from 'react'

export function CandlestickDiagram() {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20, margin: '16px 0' }}>
      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 12 }}>Diagram — Candlestick Anatomy</div>
      <svg viewBox="0 0 400 220" style={{ width: '100%', maxWidth: 400, display: 'block', margin: '0 auto' }}>
        {/* Bull candle */}
        <line x1="80" y1="20" x2="80" y2="60" stroke="#10b981" strokeWidth="2"/>
        <rect x="60" y="60" width="40" height="90" fill="#10b981" rx="2"/>
        <line x1="80" y1="150" x2="80" y2="200" stroke="#10b981" strokeWidth="2"/>
        <text x="80" y="215" textAnchor="middle" fill="#10b981" fontSize="12" fontWeight="600">Bullish</text>
        {/* Labels */}
        <line x1="125" y1="20" x2="145" y2="20" stroke="#a1a1aa" strokeWidth="1" strokeDasharray="4"/>
        <text x="150" y="24" fill="#a1a1aa" fontSize="11">HIGH (wick top)</text>
        <line x1="125" y1="60" x2="145" y2="60" stroke="#a1a1aa" strokeWidth="1" strokeDasharray="4"/>
        <text x="150" y="64" fill="#fafafa" fontSize="11" fontWeight="600">CLOSE (top of body)</text>
        <line x1="125" y1="105" x2="145" y2="105" stroke="#a1a1aa" strokeWidth="1" strokeDasharray="4"/>
        <text x="150" y="109" fill="#f59e0b" fontSize="11">BODY (open to close)</text>
        <line x1="125" y1="150" x2="145" y2="150" stroke="#a1a1aa" strokeWidth="1" strokeDasharray="4"/>
        <text x="150" y="154" fill="#a1a1aa" fontSize="11">OPEN (bottom of body)</text>
        <line x1="125" y1="200" x2="145" y2="200" stroke="#a1a1aa" strokeWidth="1" strokeDasharray="4"/>
        <text x="150" y="204" fill="#a1a1aa" fontSize="11">LOW (wick bottom)</text>
        {/* Bear candle */}
        <line x1="330" y1="20" x2="330" y2="60" stroke="#ef4444" strokeWidth="2"/>
        <rect x="310" y="60" width="40" height="90" fill="#ef4444" rx="2"/>
        <line x1="330" y1="150" x2="330" y2="200" stroke="#ef4444" strokeWidth="2"/>
        <text x="330" y="215" textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="600">Bearish</text>
        {/* Bear labels */}
        <line x1="285" y1="60" x2="305" y2="60" stroke="#a1a1aa" strokeWidth="1" strokeDasharray="4"/>
        <text x="245" y="64" fill="#a1a1aa" fontSize="11" textAnchor="end">OPEN</text>
        <line x1="285" y1="150" x2="305" y2="150" stroke="#a1a1aa" strokeWidth="1" strokeDasharray="4"/>
        <text x="245" y="154" fill="#a1a1aa" fontSize="11" textAnchor="end">CLOSE</text>
      </svg>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', textAlign: 'center', marginTop: 8 }}>
        Green = Close &gt; Open (buyers won) | Red = Close &lt; Open (sellers won)
      </div>
    </div>
  )
}

export function MarketStructureDiagram() {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20, margin: '16px 0' }}>
      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 12 }}>Diagram — Market Structure (Uptrend)</div>
      <svg viewBox="0 0 500 200" style={{ width: '100%', display: 'block' }}>
        {/* Uptrend path */}
        <polyline points="20,170 80,130 120,150 190,90 230,110 310,50 350,75 420,30" fill="none" stroke="#10b981" strokeWidth="2.5"/>
        {/* HL markers */}
        <circle cx="120" cy="150" r="5" fill="#10b981"/>
        <circle cx="230" cy="110" r="5" fill="#10b981"/>
        <circle cx="350" cy="75" r="5" fill="#10b981"/>
        {/* HH markers */}
        <circle cx="190" cy="90" r="5" fill="#f59e0b"/>
        <circle cx="310" cy="50" r="5" fill="#f59e0b"/>
        <circle cx="420" cy="30" r="5" fill="#f59e0b"/>
        {/* Labels */}
        <text x="120" y="168" textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="700">HL</text>
        <text x="230" y="128" textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="700">HL</text>
        <text x="350" y="93" textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="700">HL</text>
        <text x="190" y="80" textAnchor="middle" fill="#f59e0b" fontSize="10" fontWeight="700">HH</text>
        <text x="310" y="40" textAnchor="middle" fill="#f59e0b" fontSize="10" fontWeight="700">HH</text>
        <text x="420" y="20" textAnchor="middle" fill="#f59e0b" fontSize="10" fontWeight="700">HH</text>
        {/* Legend */}
        <circle cx="20" cy="188" r="4" fill="#f59e0b"/>
        <text x="28" y="192" fill="#a1a1aa" fontSize="10">Higher High (HH) — new peak</text>
        <circle cx="200" cy="188" r="4" fill="#10b981"/>
        <text x="208" y="192" fill="#a1a1aa" fontSize="10">Higher Low (HL) — pullback support</text>
      </svg>
    </div>
  )
}

export function LiquidityDiagram() {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20, margin: '16px 0' }}>
      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 12 }}>Diagram — Liquidity Pools (Stop Hunt)</div>
      <svg viewBox="0 0 500 220" style={{ width: '100%', display: 'block' }}>
        {/* BSL zone */}
        <rect x="0" y="10" width="500" height="25" fill="rgba(239,68,68,0.08)" rx="0"/>
        <line x1="0" y1="22" x2="500" y2="22" stroke="#ef4444" strokeWidth="1" strokeDasharray="6,4"/>
        <text x="8" y="19" fill="#ef4444" fontSize="10" fontWeight="700">BSL — Buy Side Liquidity (stop losses from shorts)</text>
        {/* SSL zone */}
        <rect x="0" y="185" width="500" height="25" fill="rgba(16,185,129,0.08)" rx="0"/>
        <line x1="0" y1="197" x2="500" y2="197" stroke="#10b981" strokeWidth="1" strokeDasharray="6,4"/>
        <text x="8" y="213" fill="#10b981" fontSize="10" fontWeight="700">SSL — Sell Side Liquidity (stop losses from longs)</text>
        {/* Price path: up to sweep BSL, then drops, then up again */}
        <polyline points="20,150 80,130 130,120 200,110 250,30 270,100 320,90 380,80 450,40" fill="none" stroke="#a1a1aa" strokeWidth="2"/>
        {/* Sweep spike up */}
        <circle cx="250" cy="30" r="5" fill="#ef4444"/>
        <text x="250" y="20" textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="700">SWEEP BSL</text>
        <text x="250" y="48" textAnchor="middle" fill="#a1a1aa" fontSize="9">↓ reverse</text>
        {/* Equal highs */}
        <line x1="150" y1="110" x2="210" y2="110" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4"/>
        <text x="180" y="105" textAnchor="middle" fill="#f59e0b" fontSize="9">equal highs = BSL pool</text>
      </svg>
    </div>
  )
}

export function PremiumDiscountDiagram() {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20, margin: '16px 0' }}>
      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 12 }}>Diagram — Premium & Discount Zones</div>
      <svg viewBox="0 0 400 240" style={{ width: '100%', maxWidth: 400, display: 'block', margin: '0 auto' }}>
        {/* Range box */}
        <rect x="60" y="20" width="120" height="200" fill="none" stroke="var(--border)" strokeWidth="1" rx="4"/>
        {/* Premium zone */}
        <rect x="60" y="20" width="120" height="100" fill="rgba(239,68,68,0.12)" rx="4 4 0 0"/>
        <text x="120" y="75" textAnchor="middle" fill="#ef4444" fontSize="13" fontWeight="700">PREMIUM</text>
        <text x="120" y="92" textAnchor="middle" fill="#a1a1aa" fontSize="10">Sell here</text>
        {/* Discount zone */}
        <rect x="60" y="120" width="120" height="100" fill="rgba(16,185,129,0.12)" rx="0 0 4 4"/>
        <text x="120" y="175" textAnchor="middle" fill="#10b981" fontSize="13" fontWeight="700">DISCOUNT</text>
        <text x="120" y="192" textAnchor="middle" fill="#a1a1aa" fontSize="10">Buy here</text>
        {/* EQ line */}
        <line x1="55" y1="120" x2="185" y2="120" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6,3"/>
        <text x="195" y="124" fill="#f59e0b" fontSize="11" fontWeight="700">50% EQ</text>
        {/* High/Low labels */}
        <text x="50" y="25" textAnchor="end" fill="#a1a1aa" fontSize="11">High</text>
        <text x="50" y="224" textAnchor="end" fill="#a1a1aa" fontSize="11">Low</text>
        {/* Arrow annotations */}
        <text x="230" y="70" fill="#ef4444" fontSize="11">← Enter short</text>
        <text x="230" y="80" fill="#a1a1aa" fontSize="10">near OB/FVG</text>
        <text x="230" y="165" fill="#10b981" fontSize="11">← Enter long</text>
        <text x="230" y="175" fill="#a1a1aa" fontSize="10">near OB/FVG</text>
      </svg>
    </div>
  )
}

export function ICCDiagram() {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20, margin: '16px 0' }}>
      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 12 }}>Diagram — ICC Setup (Long)</div>
      <svg viewBox="0 0 500 220" style={{ width: '100%', display: 'block' }}>
        {/* Price path */}
        <polyline points="20,160 60,155 100,150 140,80 160,100 180,110 200,105 240,70 300,60 380,50 450,40" fill="none" stroke="#a1a1aa" strokeWidth="1.5"/>
        {/* Base candle highlight */}
        <rect x="97" y="75" width="18" height="80" fill="rgba(245,158,11,0.2)" rx="2"/>
        <rect x="103" y="80" width="8" height="70" fill="#f59e0b" rx="1"/>
        <text x="106" y="172" textAnchor="middle" fill="#f59e0b" fontSize="9" fontWeight="700">BASE</text>
        {/* Phase labels */}
        <rect x="40" y="10" width="80" height="22" fill="rgba(59,130,246,0.15)" rx="4"/>
        <text x="80" y="25" textAnchor="middle" fill="#3b82f6" fontSize="10" fontWeight="700">① INDICATION</text>
        <line x1="120" y1="32" x2="120" y2="80" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4"/>
        <rect x="145" y="100" width="80" height="22" fill="rgba(168,85,247,0.15)" rx="4"/>
        <text x="185" y="115" textAnchor="middle" fill="#a855f7" fontSize="10" fontWeight="700">② CORRECTION</text>
        <line x1="185" y1="122" x2="185" y2="108" stroke="#a855f7" strokeWidth="1" strokeDasharray="4"/>
        <rect x="220" y="55" width="88" height="22" fill="rgba(16,185,129,0.15)" rx="4"/>
        <text x="264" y="70" textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="700">③ CONTINUATION</text>
        <line x1="240" y1="77" x2="240" y2="68" stroke="#10b981" strokeWidth="1" strokeDasharray="4"/>
        {/* Entry marker */}
        <circle cx="240" cy="68" r="5" fill="#10b981"/>
        <text x="242" y="50" fill="#10b981" fontSize="9" fontWeight="700">ENTRY</text>
        {/* SL */}
        <line x1="80" y1="158" x2="420" y2="158" stroke="#ef4444" strokeWidth="1" strokeDasharray="5,3"/>
        <text x="422" y="162" fill="#ef4444" fontSize="9">SL</text>
        {/* TP */}
        <line x1="80" y1="25" x2="420" y2="25" stroke="#10b981" strokeWidth="1" strokeDasharray="5,3"/>
        <text x="422" y="29" fill="#10b981" fontSize="9">TP</text>
        {/* KZ label */}
        <rect x="20" y="185" width="460" height="20" fill="rgba(245,158,11,0.06)" rx="3"/>
        <text x="250" y="198" textAnchor="middle" fill="#f59e0b" fontSize="10">⏰ Kill Zone Active (London 06:00–09:00 UTC)</text>
      </svg>
    </div>
  )
}

export function BosCHoCHDiagram() {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20, margin: '16px 0' }}>
      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 12 }}>Diagram — Break of Structure vs Change of Character</div>
      <svg viewBox="0 0 540 200" style={{ width: '100%', display: 'block' }}>
        {/* Divider */}
        <line x1="270" y1="0" x2="270" y2="200" stroke="var(--border)" strokeWidth="1" strokeDasharray="6,4"/>

        {/* LEFT: Break of Structure (BoS) — uptrend continues */}
        <text x="10" y="15" fill="#3b82f6" fontSize="9" fontWeight="700">BREAK OF STRUCTURE (BoS) — Trend continues</text>
        {/* Uptrend path */}
        <polyline points="15,170 55,140 80,155 125,115 155,130 200,80 230,95 260,55" fill="none" stroke="#10b981" strokeWidth="2"/>
        {/* HL dots */}
        <circle cx="80" cy="155" r="4" fill="#10b981"/>
        <circle cx="155" cy="130" r="4" fill="#10b981"/>
        <circle cx="230" cy="95" r="4" fill="#10b981"/>
        {/* HH dots */}
        <circle cx="125" cy="115" r="4" fill="#f59e0b"/>
        <circle cx="200" cy="80" r="4" fill="#f59e0b"/>
        <circle cx="260" cy="55" r="4" fill="#f59e0b"/>
        {/* BoS arrow at last HH break */}
        <line x1="200" y1="80" x2="260" y2="80" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,3"/>
        <text x="218" y="76" fill="#3b82f6" fontSize="8" fontWeight="700">BoS ↑</text>
        {/* Labels */}
        <text x="80" y="170" textAnchor="middle" fill="#10b981" fontSize="8">HL</text>
        <text x="155" y="145" textAnchor="middle" fill="#10b981" fontSize="8">HL</text>
        <text x="230" y="110" textAnchor="middle" fill="#10b981" fontSize="8">HL</text>
        <text x="200" y="73" textAnchor="middle" fill="#f59e0b" fontSize="8">HH</text>
        <text x="260" y="48" textAnchor="middle" fill="#f59e0b" fontSize="8">HH</text>
        <rect x="10" y="180" width="250" height="16" fill="rgba(59,130,246,0.1)" rx="3"/>
        <text x="135" y="191" textAnchor="middle" fill="#3b82f6" fontSize="9">Continue trading WITH the trend</text>

        {/* RIGHT: Change of Character (CHoCH) — warning */}
        <text x="280" y="15" fill="#ef4444" fontSize="9" fontWeight="700">CHANGE OF CHARACTER (CHoCH) — Warning!</text>
        {/* Uptrend then break below HL */}
        <polyline points="285,170 320,140 345,155 390,110 415,125 445,90" fill="none" stroke="#10b981" strokeWidth="2"/>
        {/* HL break (CHoCH) */}
        <polyline points="445,90 480,115 510,140" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,2"/>
        {/* Previous HL horizontal reference */}
        <line x1="415" y1="125" x2="525" y2="125" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3"/>
        <text x="527" y="128" fill="#ef4444" fontSize="8">prev HL</text>
        {/* Dots */}
        <circle cx="345" cy="155" r="4" fill="#10b981"/>
        <circle cx="415" cy="125" r="4" fill="#10b981"/>
        <circle cx="390" cy="110" r="4" fill="#f59e0b"/>
        <circle cx="445" cy="90" r="4" fill="#f59e0b"/>
        <circle cx="480" cy="115" r="4" fill="#ef4444"/>
        <circle cx="510" cy="140" r="4" fill="#ef4444"/>
        {/* CHoCH arrow */}
        <text x="490" y="108" fill="#ef4444" fontSize="8" fontWeight="700">CHoCH!</text>
        <text x="490" y="117" fill="#ef4444" fontSize="7">broke HL</text>
        <rect x="280" y="180" width="250" height="16" fill="rgba(239,68,68,0.1)" rx="3"/>
        <text x="405" y="191" textAnchor="middle" fill="#ef4444" fontSize="9">Trend may be reversing — become cautious</text>
      </svg>
    </div>
  )
}

export function OrderBlockDiagram() {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20, margin: '16px 0' }}>
      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 12 }}>Diagram — Order Block Identification</div>
      <svg viewBox="0 0 520 210" style={{ width: '100%', display: 'block' }}>
        {/* Divider */}
        <line x1="260" y1="0" x2="260" y2="210" stroke="var(--border)" strokeWidth="1" strokeDasharray="6,4"/>

        {/* LEFT: Bullish Order Block */}
        <text x="10" y="14" fill="#10b981" fontSize="9" fontWeight="700">BULLISH ORDER BLOCK</text>

        {/* Small down candles leading to OB */}
        {[[30,80,105],[55,85,110],[80,88,112]].map(([x,top,bot],i) => (
          <g key={i}>
            <line x1={x+5} y1={top-6} x2={x+5} y2={top} stroke="#ef4444" strokeWidth="1.5"/>
            <rect x={x} y={top} width={10} height={bot-top} fill="#ef4444" rx="1"/>
            <line x1={x+5} y1={bot} x2={x+5} y2={bot+6} stroke="#ef4444" strokeWidth="1.5"/>
          </g>
        ))}

        {/* The OB candle (green — last opposite before impulse) */}
        <rect x="100" y="70" width="12" height="50" fill="rgba(16,185,129,0.25)" stroke="#10b981" strokeWidth="1.5" rx="1" strokeDasharray="3,2"/>
        <line x1="106" y1="63" x2="106" y2="70" stroke="#10b981" strokeWidth="1.5"/>
        <rect x="103" y="70" width="6" height="50" fill="#10b981" rx="1"/>
        <line x1="106" y1="120" x2="106" y2="128" stroke="#10b981" strokeWidth="1.5"/>
        <text x="106" y="145" textAnchor="middle" fill="#10b981" fontSize="8" fontWeight="700">OB</text>

        {/* OB zone band */}
        <rect x="100" y="70" width="145" height="50" fill="rgba(16,185,129,0.08)" stroke="none"/>
        <line x1="100" y1="70" x2="245" y2="70" stroke="#10b981" strokeWidth="1" strokeDasharray="4,3"/>
        <line x1="100" y1="120" x2="245" y2="120" stroke="#10b981" strokeWidth="1" strokeDasharray="4,3"/>
        <text x="250" y="74" fill="#10b981" fontSize="8">OB high</text>
        <text x="250" y="124" fill="#10b981" fontSize="8">OB low</text>

        {/* Impulse candles up */}
        {[[120,45,80],[140,30,65],[160,18,52]].map(([x,top,bot],i) => (
          <g key={i}>
            <line x1={x+5} y1={top-5} x2={x+5} y2={top} stroke="#10b981" strokeWidth="1.5"/>
            <rect x={x} y={top} width={10} height={bot-top} fill="#10b981" rx="1"/>
            <line x1={x+5} y1={bot} x2={x+5} y2={bot+4} stroke="#10b981" strokeWidth="1.5"/>
          </g>
        ))}

        {/* Price returns to OB zone */}
        <polyline points="175,25 195,50 215,80 230,95 235,85" fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeDasharray="4,3"/>
        <circle cx="235" cy="85" r="4" fill="#60a5fa"/>
        <text x="235" y="75" textAnchor="middle" fill="#60a5fa" fontSize="8" fontWeight="700">ENTRY</text>
        <text x="10" y="200" fill="#a1a1aa" fontSize="9">Last BEARISH candle before bullish impulse = Bullish OB</text>

        {/* RIGHT: Bearish Order Block */}
        <text x="270" y="14" fill="#ef4444" fontSize="9" fontWeight="700">BEARISH ORDER BLOCK</text>

        {/* Small up candles */}
        {[[285,90,115],[310,85,112],[335,80,108]].map(([x,top,bot],i) => (
          <g key={i}>
            <line x1={x+5} y1={top-5} x2={x+5} y2={top} stroke="#10b981" strokeWidth="1.5"/>
            <rect x={x} y={top} width={10} height={bot-top} fill="#10b981" rx="1"/>
            <line x1={x+5} y1={bot} x2={x+5} y2={bot+5} stroke="#10b981" strokeWidth="1.5"/>
          </g>
        ))}

        {/* Bearish OB candle (red — last opposite before bearish impulse) */}
        <rect x="360" y="70" width="12" height="50" fill="rgba(239,68,68,0.25)" stroke="#ef4444" strokeWidth="1.5" rx="1" strokeDasharray="3,2"/>
        <line x1="366" y1="63" x2="366" y2="70" stroke="#ef4444" strokeWidth="1.5"/>
        <rect x="363" y="70" width="6" height="50" fill="#ef4444" rx="1"/>
        <line x1="366" y1="120" x2="366" y2="128" stroke="#ef4444" strokeWidth="1.5"/>
        <text x="366" y="145" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="700">OB</text>

        {/* OB zone band */}
        <rect x="270" y="70" width="100" height="50" fill="rgba(239,68,68,0.06)" stroke="none"/>
        <line x1="270" y1="70" x2="370" y2="70" stroke="#ef4444" strokeWidth="1" strokeDasharray="4,3"/>
        <line x1="270" y1="120" x2="370" y2="120" stroke="#ef4444" strokeWidth="1" strokeDasharray="4,3"/>

        {/* Impulse down */}
        {[[377,110,145],[394,130,165],[411,150,180]].map(([x,top,bot],i) => (
          <g key={i}>
            <line x1={x+5} y1={top-4} x2={x+5} y2={top} stroke="#ef4444" strokeWidth="1.5"/>
            <rect x={x} y={top} width={10} height={bot-top} fill="#ef4444" rx="1"/>
            <line x1={x+5} y1={bot} x2={x+5} y2={bot+4} stroke="#ef4444" strokeWidth="1.5"/>
          </g>
        ))}

        {/* Return to OB */}
        <polyline points="428,175 445,150 462,118 472,95 475,85" fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeDasharray="4,3"/>
        <circle cx="475" cy="85" r="4" fill="#60a5fa"/>
        <text x="475" y="75" textAnchor="middle" fill="#60a5fa" fontSize="8" fontWeight="700">ENTRY</text>
        <text x="270" y="200" fill="#a1a1aa" fontSize="9">Last BULLISH candle before bearish impulse = Bearish OB</text>
      </svg>
    </div>
  )
}

export function FVGDiagram() {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 20, margin: '16px 0' }}>
      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 12 }}>Diagram — Fair Value Gap (FVG)</div>
      <svg viewBox="0 0 520 210" style={{ width: '100%', display: 'block' }}>
        {/* Divider */}
        <line x1="260" y1="0" x2="260" y2="210" stroke="var(--border)" strokeWidth="1" strokeDasharray="6,4"/>

        {/* LEFT: Bullish FVG */}
        <text x="10" y="14" fill="#10b981" fontSize="9" fontWeight="700">BULLISH FVG (support / buy zone)</text>

        {/* Candle 1 */}
        <line x1="55" y1="120" x2="55" y2="130" stroke="#10b981" strokeWidth="1.5"/>
        <rect x="48" y="130" width="14" height="40" fill="#10b981" rx="1"/>
        <line x1="55" y1="170" x2="55" y2="180" stroke="#10b981" strokeWidth="1.5"/>
        <text x="55" y="197" textAnchor="middle" fill="#a1a1aa" fontSize="8">①</text>
        <text x="55" y="206" textAnchor="middle" fill="#a1a1aa" fontSize="7">Candle 1</text>
        {/* Candle 1 high reference */}
        <line x1="62" y1="120" x2="140" y2="120" stroke="#10b981" strokeWidth="1" strokeDasharray="3,3"/>
        <text x="20" y="124" fill="#10b981" fontSize="8">C1 high</text>

        {/* Candle 2 (impulse — creates the gap) */}
        <line x1="105" y1="55" x2="105" y2="65" stroke="#10b981" strokeWidth="1.5"/>
        <rect x="98" y="65" width="14" height="70" fill="#10b981" rx="1"/>
        <line x1="105" y1="135" x2="105" y2="145" stroke="#10b981" strokeWidth="1.5"/>
        <text x="105" y="197" textAnchor="middle" fill="#a1a1aa" fontSize="8">②</text>
        <text x="105" y="206" textAnchor="middle" fill="#a1a1aa" fontSize="7">Impulse</text>

        {/* Candle 3 */}
        <line x1="155" y1="70" x2="155" y2="78" stroke="#10b981" strokeWidth="1.5"/>
        <rect x="148" y="78" width="14" height="30" fill="#10b981" rx="1"/>
        <line x1="155" y1="108" x2="155" y2="116" stroke="#10b981" strokeWidth="1.5"/>
        <text x="155" y="197" textAnchor="middle" fill="#a1a1aa" fontSize="8">③</text>
        <text x="155" y="206" textAnchor="middle" fill="#a1a1aa" fontSize="7">Candle 3</text>
        {/* Candle 3 low reference */}
        <line x1="148" y1="116" x2="62" y2="116" stroke="#10b981" strokeWidth="1" strokeDasharray="3,3"/>
        <text x="20" y="120" fill="#10b981" fontSize="8">C3 low</text>

        {/* FVG zone (between C1 high and C3 low) */}
        <rect x="62" y="116" width="86" height="4" fill="rgba(16,185,129,0.35)" rx="1"/>
        <rect x="62" y="116" width="86" height="4" fill="none" stroke="#10b981" strokeWidth="1"/>
        <text x="105" y="114" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="700">GAP = FVG</text>
        <text x="105" y="107" textAnchor="middle" fill="#a1a1aa" fontSize="8">C3 low &gt; C1 high</text>

        {/* Price returns to fill */}
        <polyline points="170,88 195,100 218,118 230,117" fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeDasharray="4,3"/>
        <circle cx="230" cy="117" r="4" fill="#60a5fa"/>
        <text x="235" y="113" fill="#60a5fa" fontSize="8" fontWeight="700">FILL ↓</text>
        <text x="235" y="122" fill="#60a5fa" fontSize="7">then bounce</text>
        <rect x="10" y="178" width="240" height="14" fill="rgba(16,185,129,0.08)" rx="3"/>
        <text x="130" y="188" textAnchor="middle" fill="#10b981" fontSize="8">C3 low &gt; C1 high → Bullish FVG (support)</text>

        {/* RIGHT: Bearish FVG */}
        <text x="270" y="14" fill="#ef4444" fontSize="9" fontWeight="700">BEARISH FVG (resistance / sell zone)</text>

        {/* Candle 1 */}
        <line x1="315" y1="30" x2="315" y2="38" stroke="#ef4444" strokeWidth="1.5"/>
        <rect x="308" y="38" width="14" height="40" fill="#ef4444" rx="1"/>
        <line x1="315" y1="78" x2="315" y2="86" stroke="#ef4444" strokeWidth="1.5"/>
        <text x="315" y="197" textAnchor="middle" fill="#a1a1aa" fontSize="8">①</text>
        {/* C1 low ref */}
        <line x1="322" y1="86" x2="400" y2="86" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3"/>
        <text x="280" y="90" fill="#ef4444" fontSize="8">C1 low</text>

        {/* Candle 2 (impulse down) */}
        <line x1="365" y1="78" x2="365" y2="86" stroke="#ef4444" strokeWidth="1.5"/>
        <rect x="358" y="86" width="14" height="70" fill="#ef4444" rx="1"/>
        <line x1="365" y1="156" x2="365" y2="164" stroke="#ef4444" strokeWidth="1.5"/>
        <text x="365" y="197" textAnchor="middle" fill="#a1a1aa" fontSize="8">②</text>

        {/* Candle 3 */}
        <line x1="415" y1="100" x2="415" y2="108" stroke="#ef4444" strokeWidth="1.5"/>
        <rect x="408" y="108" width="14" height="40" fill="#ef4444" rx="1"/>
        <line x1="415" y1="148" x2="415" y2="156" stroke="#ef4444" strokeWidth="1.5"/>
        <text x="415" y="197" textAnchor="middle" fill="#a1a1aa" fontSize="8">③</text>
        {/* C3 high ref */}
        <line x1="408" y1="100" x2="322" y2="100" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3"/>
        <text x="280" y="104" fill="#ef4444" fontSize="8">C3 high</text>

        {/* FVG gap (between C3 high and C1 low) */}
        <rect x="322" y="86" width="86" height="14" fill="rgba(239,68,68,0.2)" rx="1"/>
        <rect x="322" y="86" width="86" height="14" fill="none" stroke="#ef4444" strokeWidth="1"/>
        <text x="365" y="97" textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="700">GAP = FVG</text>
        <text x="365" y="79" textAnchor="middle" fill="#a1a1aa" fontSize="8">C3 high &lt; C1 low</text>

        {/* Price returns to bearish FVG */}
        <polyline points="430,130 448,110 462,95 470,90" fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeDasharray="4,3"/>
        <circle cx="470" cy="90" r="4" fill="#60a5fa"/>
        <text x="476" y="87" fill="#60a5fa" fontSize="8" fontWeight="700">FILL ↑</text>
        <text x="476" y="96" fill="#60a5fa" fontSize="7">then drop</text>
        <rect x="270" y="178" width="240" height="14" fill="rgba(239,68,68,0.08)" rx="3"/>
        <text x="390" y="188" textAnchor="middle" fill="#ef4444" fontSize="8">C3 high &lt; C1 low → Bearish FVG (resistance)</text>
      </svg>
    </div>
  )
}

const DIAGRAMS = {
  candlestick:        CandlestickDiagram,
  'market-structure': MarketStructureDiagram,
  'bos-choch':        BosCHoCHDiagram,
  liquidity:          LiquidityDiagram,
  'order-block':      OrderBlockDiagram,
  fvg:                FVGDiagram,
  'premium-discount': PremiumDiscountDiagram,
  icc:                ICCDiagram,
}

export function Diagram({ id }) {
  const Component = DIAGRAMS[id]
  return Component ? <Component /> : null
}
