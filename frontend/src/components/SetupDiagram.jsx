import React from 'react'

const DEC = { XAUUSD: 2, NZDJPY: 3, GBPJPY: 3, DEFAULT: 5 }
function fmt(p, pair) {
  const d = DEC[pair] ?? DEC.DEFAULT
  return p?.toFixed(d) ?? '—'
}

export default function SetupDiagram({ entry, sl, tp1, tp2, tp3, direction, pair }) {
  const isLong = direction === 'long'
  const W = 240, H = 160
  const PAD_L = 8, PAD_R = 72, PAD_T = 12, PAD_B = 12
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B

  const prices = [sl, entry, tp1, tp2, tp3].filter(p => p != null)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || 1

  // price → SVG y (top = high price)
  const y = (p) => PAD_T + chartH * (1 - (p - minP) / range)
  const clamp = (v) => Math.max(PAD_T + 1, Math.min(H - PAD_B - 1, v))
  const ly = (p) => clamp(y(p))

  const x1 = PAD_L
  const x2 = W - PAD_R
  const labelX = x2 + 5

  const LEVELS = [
    { price: tp3, label: 'TP3', color: '#22d3a5', weight: 1.5, dash: '4,2' },
    { price: tp2, label: 'TP2', color: '#22d3a5', weight: 1,   dash: '4,2' },
    { price: tp1, label: 'TP1', color: '#22d3a5', weight: 1,   dash: '4,2' },
    { price: entry, label: 'ENT', color: '#60a5fa', weight: 2, dash: null  },
    { price: sl,    label: 'SL',  color: '#f87171', weight: 1.5, dash: '3,2' },
  ]

  // Arrow: entry → tp3 (profit direction) and entry → sl (loss direction)
  const arrowBody = {
    profit: { y1: ly(entry), y2: ly(tp3), color: '#22d3a5' },
    risk:   { y1: ly(entry), y2: ly(sl),  color: '#f87171' },
  }
  const arrowX = PAD_L + 14

  return (
    <svg
      width={W} height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', borderRadius: 8, overflow: 'visible' }}
    >
      {/* Background */}
      <rect width={W} height={H} rx={8} fill="#0f0f1a" />

      {/* Profit zone fill */}
      <rect
        x={x1 + 4} y={Math.min(ly(entry), ly(tp3))}
        width={chartW - 4}
        height={Math.abs(ly(tp3) - ly(entry))}
        fill="rgba(34,211,165,0.07)"
      />

      {/* Risk zone fill */}
      <rect
        x={x1 + 4} y={Math.min(ly(entry), ly(sl))}
        width={chartW - 4}
        height={Math.abs(ly(sl) - ly(entry))}
        fill="rgba(248,113,113,0.07)"
      />

      {/* Direction arrow */}
      <line x1={arrowX} y1={arrowBody.profit.y1} x2={arrowX} y2={arrowBody.profit.y2}
        stroke={arrowBody.profit.color} strokeWidth={2} opacity={0.5} />
      <line x1={arrowX} y1={arrowBody.risk.y1} x2={arrowX} y2={arrowBody.risk.y2}
        stroke={arrowBody.risk.color} strokeWidth={2} opacity={0.5} />
      {/* Arrowhead */}
      {isLong ? (
        <polygon
          points={`${arrowX - 4},${ly(tp3) + 6} ${arrowX + 4},${ly(tp3) + 6} ${arrowX},${ly(tp3) - 1}`}
          fill="#22d3a5" opacity={0.7}
        />
      ) : (
        <polygon
          points={`${arrowX - 4},${ly(tp3) - 6} ${arrowX + 4},${ly(tp3) - 6} ${arrowX},${ly(tp3) + 1}`}
          fill="#22d3a5" opacity={0.7}
        />
      )}

      {/* Price lines + labels */}
      {LEVELS.map(({ price, label, color, weight, dash }) => {
        if (price == null) return null
        const yPos = ly(price)
        return (
          <g key={label}>
            <line
              x1={x1 + 20} y1={yPos} x2={x2} y2={yPos}
              stroke={color} strokeWidth={weight}
              strokeDasharray={dash || undefined}
              opacity={label === 'ENT' ? 1 : 0.75}
            />
            <text
              x={labelX} y={yPos + 3.5}
              fill={color}
              fontSize={8.5}
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={label === 'ENT' ? 700 : 400}
            >
              {label} {fmt(price, pair)}
            </text>
          </g>
        )
      })}

      {/* Entry marker dot */}
      <circle cx={x2 - 4} cy={ly(entry)} r={3} fill="#60a5fa" />
    </svg>
  )
}
