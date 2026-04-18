export const CURRICULUM = [
  {
    id: 'module-1',
    title: 'How Markets Really Work',
    description: 'Understand the true engine behind price movement — not what retail traders think, but what institutions actually do.',
    icon: '🏦',
    color: '#f59e0b',
    lessons: [
      {
        id: 'lesson-1-1',
        title: 'The Truth About Financial Markets',
        duration: '10 min',
        content: [
          { type: 'text', content: 'Most retail traders are taught a lie. They are told that price moves based on supply and demand — buy more than sell, price goes up. Simple economics. But if that were true, why do 80% of retail traders lose money consistently, while the top 1% make extraordinary returns year after year?' },
          { type: 'highlight', title: 'The Real Market Participants', content: 'Forex trades $7.5 trillion per day. Of that, roughly 5% is retail traders. The other 95% is banks, hedge funds, central banks, and large institutions. Price is not democratically determined — it is engineered by those with the largest positions.' },
          { type: 'text', content: 'Think about this: when you place a buy order, someone has to be selling to you. When institutions want to buy billions of dollars worth of currency, they cannot just hit the market — it would move price against them before they finish filling their position. They need liquidity. They need retail traders to provide the other side of their trade.' },
          { type: 'concept', title: 'The Bank\'s Problem', content: 'A hedge fund wants to buy 2 billion in GBPUSD. If they buy all at once, price spikes and they get terrible average entry. So they do the opposite first — they push price DOWN to where retail traders have their stop losses. Retail stops are triggered, retail traders sell in panic. The bank buys all that selling. Then price reverses sharply upward. This is not manipulation — it is engineering. This is the game.' },
          { type: 'text', content: 'The moment you understand this, everything about charts starts making sense. The "false breakouts" you\'ve experienced — price breaks a level, hunts your stop, then reverses — that IS the setup. The bank was filling their order using your stop loss as fuel.' },
          { type: 'highlight', title: 'Key Insight', content: 'Price does not move randomly. It moves to collect liquidity (stop losses and pending orders) before delivering to the next target. Your job as a trader is to identify WHERE that liquidity is, and WHERE price is going next — then get in AFTER the hunt, not before it.' },
        ],
        quiz: [
          { question: 'What percentage of the Forex market is retail traders?', options: ['50%', '30%', '5%', '20%'], correct: 2, explanation: 'Retail traders make up roughly 5% of daily Forex volume. The other 95% is institutions, banks, hedge funds, and central banks.' },
          { question: 'Why do institutions push price lower before going long?', options: ['They make more profit', 'They need liquidity (retail stop losses) to fill large orders', 'To test support levels', 'Random market behavior'], correct: 1, explanation: 'Institutions need large volumes of orders to fill their positions. Retail stop losses provide that liquidity, which is why price often appears to "hunt stops" before moving in the real direction.' },
          { question: 'What should you do when you see a false breakout?', options: ['Sell immediately', 'Exit your position', 'Recognize it as a liquidity hunt and prepare for the real move', 'Ignore it'], correct: 2, explanation: 'False breakouts (stop hunts) are not random — they are institutions filling orders. After the hunt, the real directional move begins.' }
        ]
      },
      {
        id: 'lesson-1-2',
        title: 'Currency Pairs, Pips & Lots',
        duration: '12 min',
        content: [
          { type: 'text', content: 'Before you can trade, you need to speak the language. Forex has its own terminology that, once learned, becomes second nature.' },
          { type: 'subheading', content: 'Currency Pairs' },
          { type: 'text', content: 'In Forex, you always trade one currency AGAINST another. GBPUSD means you are buying British Pounds and selling US Dollars (or vice versa). The first currency (GBP) is the BASE currency. The second (USD) is the QUOTE currency.' },
          { type: 'concept', title: 'Major Pairs', content: 'EURUSD — Euro vs Dollar\nGBPUSD — Pound vs Dollar\nUSDJPY — Dollar vs Yen\nUSDCHF — Dollar vs Swiss Franc\nAUDUSD — Australian Dollar vs Dollar\n\nThese are the most liquid pairs — lowest spread, most institutional activity.' },
          { type: 'subheading', content: 'What is a Pip?' },
          { type: 'text', content: 'A pip (Percentage in Point) is the smallest standard price move in Forex. For most pairs (EURUSD, GBPUSD), 1 pip = 0.0001. If GBPUSD moves from 1.3500 to 1.3501, that is 1 pip.' },
          { type: 'formula', title: 'Pip for JPY Pairs', content: 'For JPY pairs (GBPJPY, USDJPY), 1 pip = 0.01\nIf GBPJPY moves from 192.50 to 192.51 = 1 pip\nBe careful — JPY pairs move in much larger pip counts.' },
          { type: 'subheading', content: 'Lots & Position Size' },
          { type: 'text', content: 'A "lot" is your trade size. It determines how much money you make or lose per pip.' },
          { type: 'table', headers: ['Lot Type', 'Units', 'Value per pip (USD pair)'], rows: [['Standard', '100,000', '$10'], ['Mini', '10,000', '$1'], ['Micro', '1,000', '$0.10'], ['Nano', '100', '$0.01']] },
          { type: 'example', title: 'Real Example', content: 'You buy 0.1 lots (mini lot) of GBPUSD.\nGBPUSD moves up 50 pips.\nProfit = 50 pips × $1/pip = $50\n\nYou buy 1.0 lot (standard) of GBPUSD.\nGBPUSD moves up 50 pips.\nProfit = 50 pips × $10/pip = $500' },
          { type: 'subheading', content: 'Leverage & Margin' },
          { type: 'text', content: 'Leverage allows you to control a large position with a small deposit. 1:100 leverage means with $1,000 you can control $100,000.' },
          { type: 'warning', content: 'Leverage amplifies BOTH profits AND losses. A professional trader treats leverage as a tool, not a feature. Most institutional traders use far less leverage than retail traders think. Survive first — grow second.' },
        ],
        quiz: [
          { question: 'In GBPUSD, which is the base currency?', options: ['USD', 'GBP', 'Both', 'Neither'], correct: 1, explanation: 'GBP (British Pound) is the base currency — the one you are buying or selling. USD is the quote currency.' },
          { question: 'GBPUSD moves from 1.3500 to 1.3550. How many pips did it move?', options: ['5', '50', '0.5', '500'], correct: 1, explanation: '1.3550 - 1.3500 = 0.0050 = 50 pips. Each 0.0001 = 1 pip.' },
          { question: 'You trade 0.1 lots of EURUSD. It moves 30 pips in your favor. What is your profit?', options: ['$30', '$300', '$3', '$3,000'], correct: 0, explanation: '0.1 lots = $1/pip. 30 pips × $1 = $30.' }
        ]
      },
      {
        id: 'lesson-1-3',
        title: 'Sessions, Spread & When to Trade',
        duration: '8 min',
        content: [
          { type: 'text', content: 'Forex is a 24-hour market — but not all hours are equal. Price moves most aggressively during certain sessions when the major banks are active. Trading outside these windows is like fishing in an empty pond.' },
          { type: 'concept', title: 'The 3 Major Sessions', content: 'ASIAN SESSION: 23:00–08:00 UTC\nLow volatility, price ranges. JPY pairs most active. Good for accumulation phase.\n\nLONDON SESSION: 07:00–16:00 UTC\nHighest volume session. London is the world\'s largest Forex center. Major moves begin here.\n\nNEW YORK SESSION: 12:00–21:00 UTC\nSecond highest volume. Overlaps with London 12:00–16:00 UTC = the most volatile window.' },
          { type: 'highlight', title: 'ICT Kill Zones — Where Setups Happen', content: 'London Kill Zone: 06:00–09:00 UTC (best for GBPUSD, EURUSD, GBPJPY)\nNew York Kill Zone: 11:00–14:00 UTC (strong setups, especially post-London)\n\nThese are the windows when institutional orders are most aggressively placed. 80% of high-quality setups occur within these windows. Outside of Kill Zones — wait or observe only.' },
          { type: 'subheading', content: 'The Spread' },
          { type: 'text', content: 'The spread is the difference between the buy price (ask) and sell price (bid). If GBPUSD bid is 1.3500 and ask is 1.3502, the spread is 2 pips. This is the broker\'s fee.' },
          { type: 'warning', content: 'During news events (CPI, NFP, FOMC), spreads can widen to 10–50 pips instantly. Never place a trade within 5 minutes of a major news release. Wait for the spike, wait for the spread to normalize, then analyze.' },
        ],
        quiz: [
          { question: 'What is the most volatile Forex trading window?', options: ['Asian session', 'London-NY overlap (12:00-16:00 UTC)', 'Late NY session', 'Weekend gaps'], correct: 1, explanation: 'The London-New York overlap (12:00-16:00 UTC) has the highest combined volume and produces the most significant price moves.' },
          { question: 'The ICT London Kill Zone is:', options: ['07:00-10:00 UTC', '06:00-09:00 UTC', '09:00-12:00 UTC', '05:00-08:00 UTC'], correct: 1, explanation: 'The London Kill Zone is 06:00-09:00 UTC — the first 3 hours of the London session when institutional orders are placed most aggressively.' },
          { question: 'Why should you avoid trading during major news releases?', options: ['Markets close during news', 'Spreads widen and price moves erratically', 'Indicators stop working', 'Volume drops to zero'], correct: 1, explanation: 'During news releases, spreads can widen dramatically and price spikes unpredictably. This makes risk management nearly impossible.' }
        ]
      }
    ]
  },
  {
    id: 'module-2',
    title: 'Reading the Chart',
    description: 'Master candlestick reading, timeframes, and how to interpret price action the way institutions see it.',
    icon: '📊',
    color: '#3b82f6',
    lessons: [
      {
        id: 'lesson-2-1',
        title: 'Candlestick Anatomy',
        duration: '10 min',
        content: [
          { type: 'text', content: 'Every candlestick tells a story — a battle between buyers and sellers within a specific time period. Learning to read that story is the foundation of all technical analysis.' },
          { type: 'diagram', id: 'candlestick' },
          { type: 'concept', title: 'The 4 Parts of Every Candle', content: 'OPEN: Where price started at the beginning of the period\nCLOSE: Where price ended at the end of the period\nHIGH: The highest point reached during the period\nLOW: The lowest point reached during the period\n\nThe BODY is the area between open and close.\nThe WICKS (shadows) extend from the body to the high and low.' },
          { type: 'text', content: 'A green (or white) candle means close > open — buyers won that period. A red (or black) candle means close < open — sellers won that period.' },
          { type: 'subheading', content: 'Reading Candle Strength' },
          { type: 'text', content: 'The most important concept in candlestick analysis is the BODY-TO-RANGE RATIO. This is how much of the total candle range was body (conviction) vs wick (rejection).' },
          { type: 'formula', title: 'Body Ratio Formula', content: 'Body Ratio = Body Size / Total Range\nBody Size = |Close - Open|\nTotal Range = High - Low\n\nBody Ratio > 0.60 = Strong candle (institutional conviction)\nBody Ratio < 0.40 = Weak candle (indecision)\nBody Ratio ≈ 0 = Doji (complete indecision)' },
          { type: 'example', title: 'Why This Matters for ICC', content: 'The ICC strategy specifically requires a BASE CANDLE with a body ratio of at least 60%. This means the candle must be at least 60% body — showing strong institutional commitment to one direction. A 90% body bull candle means buyers dominated completely — almost no wick. That is the strongest signal.' },
          { type: 'highlight', title: 'Key Candlestick Patterns', content: 'DOJI: Body ≈ 0. Indecision. Neither side won.\nHAMMER: Small body at top, long lower wick. Buyers rejected a push lower — bullish.\nSHOOTING STAR: Small body at bottom, long upper wick. Sellers rejected a push higher — bearish.\nENGULFING: Current candle body completely covers previous candle body. Strong reversal signal.' },
        ],
        quiz: [
          { question: 'A candle opens at 1.3500 and closes at 1.3540. The high is 1.3550 and low is 1.3490. What is the body ratio?', options: ['67%', '50%', '80%', '40%'], correct: 0, explanation: 'Body = 1.3540 - 1.3500 = 40 pips. Range = 1.3550 - 1.3490 = 60 pips. Ratio = 40/60 = 67%.' },
          { question: 'For the ICC strategy, what minimum body ratio is required for a Base Candle?', options: ['40%', '50%', '60%', '75%'], correct: 2, explanation: 'The ICC strategy requires a body ratio of at least 60% for a valid Base Candle — this ensures strong institutional conviction behind the move.' },
          { question: 'A hammer candlestick signals:', options: ['Bearish continuation', 'Bullish reversal (buyers rejected lower prices)', 'Indecision', 'Bearish reversal'], correct: 1, explanation: 'A hammer has a small body at the top and a long lower wick, showing that sellers pushed price down but buyers strongly rejected those lower prices.' }
        ]
      },
      {
        id: 'lesson-2-2',
        title: 'Timeframes — The Multi-Dimensional View',
        duration: '10 min',
        content: [
          { type: 'text', content: 'One of the biggest mistakes new traders make is trading from a single timeframe. The same chart looks completely different on different timeframes — and all of them are correct. Your job is to read the full picture.' },
          { type: 'concept', title: 'The Timeframe Hierarchy', content: 'WEEKLY (W): Macro bias. 1 candle = 5 trading days. Institutional positioning.\nDAILY (D): Major structure. 1 candle = 1 trading day. Key support/resistance.\n4-HOUR (4H): Medium-term trend. Good for structure.\n1-HOUR (1H): Entry timeframe. Where setups form.\n15-MIN (15M): Confirmation timeframe.\n5-MIN (5M): Precision entry. Where you execute.\n1-MIN (1M): Only for ultra-precise scalping.' },
          { type: 'highlight', title: 'The Golden Rule: Top-Down Analysis', content: 'ALWAYS analyze from high to low timeframe:\n1. Weekly → What is the macro trend?\n2. Daily → What is this week\'s direction?\n3. 4H/1H → Where are the key levels and structure?\n4. 5M → Where exactly do I enter?\n\nNever take a 5M trade against a Weekly trend. The higher timeframe ALWAYS wins.' },
          { type: 'example', title: 'Example: GBPUSD April 2026', content: 'Weekly: Strong uptrend — higher highs every week\nDaily: Bullish trend continuing\n1H: Price pulled back to a key level (1.35000 area)\n5M: ICC setup forms with a base candle + correction\n\nResult: High-probability long entry because ALL timeframes aligned.' },
          { type: 'warning', content: 'The 5M chart is only for entry timing. If you are making your trading DECISIONS on a 5M chart, you are guessing. Make decisions on the 1H/4H, execute on the 5M.' },
        ],
        quiz: [
          { question: 'Which timeframe should you use to make your trading decision (bias)?', options: ['1M', '5M', 'Weekly/Daily', 'All the same'], correct: 2, explanation: 'Trading decisions (bias, direction) should be made on higher timeframes (Weekly/Daily). Lower timeframes (5M) are only for entry timing.' },
          { question: 'In top-down analysis, which timeframe do you start with?', options: ['5M', '1H', 'Weekly', '15M'], correct: 2, explanation: 'Always start from the highest timeframe (Weekly) and work down. The higher timeframe provides the context for everything below it.' },
          { question: 'You see a strong sell setup on the 5M chart but the Daily trend is bullish. What should you do?', options: ['Take the short trade', 'Skip it — trading against Daily trend is high risk', 'Switch to a different pair', 'Use a wider stop loss'], correct: 1, explanation: 'Higher timeframes always take priority. A short on a 5M chart against a Daily uptrend is fighting the dominant institutional order flow.' }
        ]
      }
    ]
  },
  {
    id: 'module-3',
    title: 'Market Structure',
    description: 'Learn to read the narrative of price — who is in control, when trends change, and where the institutional footprints are.',
    icon: '🏗️',
    color: '#8b5cf6',
    lessons: [
      {
        id: 'lesson-3-1',
        title: 'Trends, Breaks & Bias',
        duration: '12 min',
        content: [
          { type: 'text', content: 'Market structure is the backbone of all institutional analysis. Before placing any trade, you must answer one question: who is currently in control — buyers or sellers?' },
          { type: 'diagram', id: 'market-structure' },
          { type: 'concept', title: 'The 3 Market States', content: 'UPTREND: Higher Highs (HH) + Higher Lows (HL)\nEach swing high is higher than the last. Each pullback finds support above the previous low.\n\nDOWNTREND: Lower Lows (LL) + Lower Highs (LH)\nEach swing low is lower than the last. Each rally fails below the previous high.\n\nRANGE: No clear sequence of HH/HL or LL/LH\nPrice oscillating between a defined high and low.' },
          { type: 'subheading', content: 'Break of Structure (BoS)' },
          { type: 'text', content: 'A Break of Structure occurs when price breaks beyond the last significant swing high or low, CONFIRMING the trend continues. In an uptrend, when price breaks above the previous HH — that is a BoS. The trend is confirmed to continue upward.' },
          { type: 'subheading', content: 'Change of Character (CHoCH)' },
          { type: 'text', content: 'A Change of Character is the FIRST sign the trend may be reversing. In an uptrend, a CHoCH happens when price breaks BELOW the most recent Higher Low — for the first time. This does not confirm a reversal yet, but it is the warning signal.' },
          { type: 'highlight', title: 'BoS vs CHoCH — The Critical Difference', content: 'BoS = Continuation (trend is healthy, keep trading with it)\nCHoCH = Warning (trend may be ending, become cautious)\n\nFor entries: look for CHoCH on 5M during a Kill Zone to confirm the ICC setup is triggering.' },
          { type: 'diagram', id: 'bos-choch' },
          { type: 'example', title: 'Reading the GBPUSD April 2026 Structure', content: 'Weekly: HH made at 1.3600 → HL at 1.3300 → Now pushing for new HH. BULLISH.\nDaily: Series of HL forming since March 19. No LL has been made. BULLISH.\nConclusion: Bias is LONG only until the daily structure changes (LL forms).' },
        ],
        quiz: [
          { question: 'What defines an uptrend?', options: ['Price moving up', 'Higher Highs AND Higher Lows', 'Price above a moving average', 'Strong green candles'], correct: 1, explanation: 'An uptrend is specifically defined as a series of Higher Highs (HH) AND Higher Lows (HL). Both conditions must be present.' },
          { question: 'What is a Change of Character (CHoCH) in an uptrend?', options: ['A new all-time high', 'Price breaks below the most recent Higher Low', 'A strong bearish candle', 'Price reaches a resistance level'], correct: 1, explanation: 'CHoCH in an uptrend is when price breaks below the most recent Higher Low — the first sign the bullish structure may be failing.' },
          { question: 'Your bias should be determined on which timeframe?', options: ['5M entry chart', '1M precision chart', 'Higher timeframes (Daily/Weekly)', 'Whichever has a clear signal'], correct: 2, explanation: 'Bias — whether to look for longs or shorts — must always be determined from higher timeframes (Daily/Weekly). Lower timeframes only show entry timing.' }
        ]
      }
    ]
  },
  {
    id: 'module-4',
    title: 'Liquidity — The Real Engine',
    description: 'This is what 95% of traders never understand. Where is the money? Where are the stops? This is how institutions actually move price.',
    icon: '💧',
    color: '#06b6d4',
    lessons: [
      {
        id: 'lesson-4-1',
        title: 'What is Liquidity?',
        duration: '14 min',
        content: [
          { type: 'text', content: 'Liquidity is the fuel that moves markets. To understand why price moves the way it does, you must understand liquidity — not just as a concept, but as a map of where orders are stored.' },
          { type: 'highlight', title: 'The Core Principle', content: 'Institutions need large amounts of orders to fill their positions. Stop losses from retail traders ARE those orders. When retail traders place stop losses, they are literally creating a pool of orders that institutions use to enter the market.' },
          { type: 'diagram', id: 'liquidity' },
          { type: 'concept', title: 'Two Types of Liquidity', content: 'BUY SIDE LIQUIDITY (BSL):\n• Located ABOVE swing highs and equal highs\n• These are stop losses from SHORT traders\n• Also: buy stop orders from breakout traders\n• When price sweeps above a high → BSL cleared\n\nSELL SIDE LIQUIDITY (SSL):\n• Located BELOW swing lows and equal lows\n• These are stop losses from LONG traders\n• Also: sell stop orders from breakdown traders\n• When price sweeps below a low → SSL cleared' },
          { type: 'text', content: 'This is why price constantly overshoots key levels. When everyone expects price to bounce at a support level, institutions drive price slightly below it — taking out all the stop losses from people who bought at support — then reverse sharply upward. The "false breakdown" is the fill.' },
          { type: 'subheading', content: 'Equal Highs & Equal Lows — The Magnets' },
          { type: 'text', content: 'When price creates two or more highs at approximately the same level, those equal highs hold DOUBLE liquidity — two rounds of stop losses stacked at the same price. These are extremely strong magnets. Price will almost always reach them.' },
          { type: 'example', title: 'Trading Application', content: 'GBPUSD makes highs at 1.3545, then 1.3547 (equal highs). This is a BSL pool.\nIf your 1H bias is bullish → target is 1.3545–1.3550 (the BSL pool)\nIf you are short → place TP at 1.3545 (before BSL)\n\nAlways be on the correct side of liquidity. Never buy INTO BSL. Never short INTO SSL.' },
          { type: 'warning', content: 'NEVER place a stop loss at an obvious level — the exact swing low, the exact round number (1.3500), the exact previous high. These are the first places institutions will sweep. Put your stop 5-10 pips BEYOND those obvious levels, or better yet, enter late enough that your stop is beyond the swept level.' },
        ],
        quiz: [
          { question: 'Where is Buy Side Liquidity (BSL) located?', options: ['Below swing lows', 'Above swing highs', 'At moving averages', 'At round numbers only'], correct: 1, explanation: 'BSL is located above swing highs where short traders have placed their stop losses. Institutions need to buy FROM those sellers.' },
          { question: 'When price sweeps below a swing low and immediately reverses higher, what happened?', options: ['A support level held', 'A trend reversal began', 'SSL was taken — institutions bought the sell-side orders', 'A random price move'], correct: 2, explanation: 'The sweep below the swing low took Sell Side Liquidity (SSL) — the stop losses of long traders. Institutions bought those orders at the lows, then price reversed in their favor.' },
          { question: 'Why are equal highs considered strong liquidity magnets?', options: ['They indicate a strong uptrend', 'They hold double liquidity — two sets of stop losses at the same level', 'They are easier to see', 'Institutions avoid equal highs'], correct: 1, explanation: 'Equal highs accumulate two (or more) rounds of stop losses at the same price level, making them especially attractive for institutions to sweep.' }
        ]
      },
      {
        id: 'lesson-4-2',
        title: 'IPDA — Where Is Price Going?',
        duration: '10 min',
        content: [
          { type: 'text', content: 'IPDA (Interbank Price Delivery Algorithm) is the concept that price is always in the process of reaching toward the next significant liquidity pool. Understanding this tells you WHERE price is going — not just what it is doing right now.' },
          { type: 'concept', title: 'IPDA 20-Day Look Back', content: 'Look at the last 20 trading days on the daily chart.\nIdentify the HIGHEST high made in those 20 days (BSL target above)\nIdentify the LOWEST low made in those 20 days (SSL target below)\n\nPrice is always in the process of moving from one of these to the other. If price recently swept the SSL (20-day low) → next target is the BSL (20-day high). And vice versa.' },
          { type: 'highlight', title: 'The Simple Trading Rule', content: 'After SSL is swept → look for LONGS targeting BSL\nAfter BSL is swept → look for SHORTS targeting SSL\n\nThis single concept alone is more valuable than most trading courses. Price ping-pongs between these two pools.' },
          { type: 'example', title: 'GBPUSD April 2026 Application', content: 'Looking at 20 trading days back from April 15:\n• 20-day low (SSL): ~1.32000 area (swept in early March)\n• 20-day high (BSL): ~1.36000 area (not yet swept)\n\nThe SSL was already swept. Price is now delivering UPWARD toward the BSL at 1.36000. This is why we have been biased LONG the entire month.' },
        ],
        quiz: [
          { question: 'What does IPDA stand for?', options: ['International Price Direction Algorithm', 'Interbank Price Delivery Algorithm', 'Institutional Price Data Analysis', 'Internal Price Discovery Algorithm'], correct: 1, explanation: 'IPDA stands for Interbank Price Delivery Algorithm — it describes how price algorithmically delivers from one liquidity pool to the next.' },
          { question: 'Using the IPDA 20-day look back, after the 20-day low (SSL) is swept, what should your bias be?', options: ['Short, targeting more lows', 'Long, targeting the 20-day high (BSL)', 'Neutral, wait for confirmation', 'Short the first rally'], correct: 1, explanation: 'After SSL is swept, institutions have filled their buy orders. The next target is the Buy Side Liquidity (BSL) at the 20-day high.' }
        ]
      }
    ]
  },
  {
    id: 'module-5',
    title: 'ICT Toolkit',
    description: 'The exact tools institutional traders use: Order Blocks, Fair Value Gaps, Premium & Discount, Kill Zones.',
    icon: '🛠️',
    color: '#10b981',
    lessons: [
      {
        id: 'lesson-5-1',
        title: 'Order Blocks',
        duration: '12 min',
        content: [
          { type: 'text', content: 'An Order Block (OB) is the last candle in the opposite direction before a significant move. It represents the zone where institutions placed their orders — and they will defend that zone on a retest.' },
          { type: 'concept', title: 'Bullish Order Block', content: 'Look for a BEARISH (red/down) candle immediately before a strong bullish impulse move upward. That bearish candle IS the order block. The zone is defined by its high and low.\n\nWhen price returns to this zone → look for long entries.' },
          { type: 'concept', title: 'Bearish Order Block', content: 'Look for a BULLISH (green/up) candle immediately before a strong bearish impulse move downward. That bullish candle IS the order block. The zone is defined by its high and low.\n\nWhen price returns to this zone → look for short entries.' },
          { type: 'diagram', id: 'order-block' },
          { type: 'highlight', title: 'Why Order Blocks Work', content: 'Institutions placed large orders in that candle. They did not get fully filled. When price returns to that zone, the remaining orders activate — acting as support/resistance and launching price in the original direction again.' },
          { type: 'warning', content: 'Not all Order Blocks are valid. Only use OBs that: (1) were followed by a strong impulse move, (2) have not been retested yet, (3) align with your HTF bias. A "used" OB (already retested once) loses much of its power.' },
        ],
        quiz: [
          { question: 'A Bullish Order Block is:', options: ['A strong green candle before a rally', 'The last bearish candle before a strong bullish move', 'Any area of consolidation', 'A candle with a long lower wick'], correct: 1, explanation: 'A Bullish OB is the last BEARISH candle before a significant upward move. Institutions placed their buy orders in that candle.' },
          { question: 'When is an Order Block considered "used" or less valid?', options: ['After it forms', 'After price has already retested it once', 'After 10 candles', 'When the trend changes'], correct: 1, explanation: 'An OB loses much of its strength after being retested once. The first retest is the highest probability. Subsequent retests are progressively weaker.' }
        ]
      },
      {
        id: 'lesson-5-2',
        title: 'Fair Value Gaps',
        duration: '10 min',
        content: [
          { type: 'text', content: 'A Fair Value Gap (FVG) is a price inefficiency — a zone where price moved so fast that no two-sided trading occurred. The market tends to return to these gaps to "fill" them.' },
          { type: 'concept', title: 'How to Identify an FVG', content: 'Look at 3 consecutive candles:\n• Candle 1: Any candle\n• Candle 2: A strong impulse candle (the gap creator)\n• Candle 3: Any candle\n\nA BULLISH FVG exists when: Candle 3 low > Candle 1 high\n(The gap between candle 1\'s top and candle 3\'s bottom was never traded)\n\nA BEARISH FVG exists when: Candle 3 high < Candle 1 low\n(The gap between candle 1\'s bottom and candle 3\'s top was never traded)' },
          { type: 'diagram', id: 'fvg' },
          { type: 'highlight', title: 'Trading FVGs', content: 'Bullish FVG = Support zone. When price returns and touches this gap → look for long entries.\nBearish FVG = Resistance zone. When price returns and touches this gap → look for short entries.\n\nFVGs + Order Blocks + Kill Zone timing = very high probability entry zone.' },
        ],
        quiz: [
          { question: 'What creates a Fair Value Gap?', options: ['Slow sideways price action', 'Price moving so fast that a gap is left with no two-sided trading', 'A news event only', 'An opening gap between sessions'], correct: 1, explanation: 'FVGs are created when price moves so rapidly that trading only happened in one direction, leaving a gap/inefficiency that the market tends to return to fill.' }
        ]
      },
      {
        id: 'lesson-5-3',
        title: 'Premium, Discount & Kill Zones',
        duration: '10 min',
        content: [
          { type: 'text', content: 'The concepts of Premium and Discount give you one simple rule: buy cheap, sell expensive. But we define cheap and expensive relative to the current price range — not arbitrarily.' },
          { type: 'diagram', id: 'premium-discount' },
          { type: 'concept', title: 'The 50% Rule', content: 'Take any significant price range (swing low to swing high).\nThe midpoint (50% level) = equilibrium.\n\nPREMIUM: Upper 50% of the range. Price is "expensive." Look for SHORTS here.\nDISCOUNT: Lower 50% of the range. Price is "cheap." Look for LONGS here.\n\nNever buy in premium. Never sell in discount. This alone filters out 60% of bad trades.' },
          { type: 'highlight', title: 'Kill Zones — Time Is Everything', content: 'London Kill Zone: 06:00–09:00 UTC\nNew York Kill Zone: 11:00–14:00 UTC\n\nDuring Kill Zones, institutions are actively placing orders. The setups that form here have institutional backing — they are not random. Outside of Kill Zones, setups may look identical but have much lower probability of follow-through.' },
          { type: 'example', title: 'Premium + KZ Short Example', content: 'GBPUSD in a bearish daily trend.\nPrice rallies into the upper 50% (premium zone) between 08:00-09:00 UTC (London KZ).\nA bearish order block is present in the premium zone.\n→ This is a very high probability short setup. All 3 confluences align.' },
        ],
        quiz: [
          { question: 'If the swing range is 1.3400 (low) to 1.3600 (high), the equilibrium (50%) is at:', options: ['1.3450', '1.3500', '1.3550', '1.3480'], correct: 1, explanation: '50% of the range: 1.3400 + (1.3600-1.3400)/2 = 1.3400 + 0.0100 = 1.3500.' },
          { question: 'You want to go long. Where should your entry ideally be?', options: ['Premium zone (upper 50%)', 'Discount zone (lower 50%)', 'At the swing high', 'It does not matter'], correct: 1, explanation: 'Long entries should be taken in the DISCOUNT zone (lower 50% of the range) — buying cheap. Entering in premium means you are buying expensive.' }
        ]
      }
    ]
  },
  {
    id: 'module-6',
    title: 'The ICC Method',
    description: 'Your primary trading system: Indication, Correction, Continuation. This is the complete setup from identification to execution.',
    icon: '⚡',
    color: '#f59e0b',
    lessons: [
      {
        id: 'lesson-6-1',
        title: 'ICC Phase 1 — The Indication',
        duration: '10 min',
        content: [
          { type: 'text', content: 'The ICC method, developed by @TradesBySci, breaks every trade down into three logical phases. When all three align — you have a setup. When one is missing — you wait.' },
          { type: 'concept', title: 'Phase 1: Indication', content: 'The Indication is a STRONG, DECISIVE price move in one direction. It must be:\n• A single candle or short burst of candles with strong bodies\n• Body ratio ≥ 60% (showing conviction, not just noise)\n• Breaking a recent swing high (bullish) or swing low (bearish)\n• Occurring WITHIN a Kill Zone (London or NY)\n\nThis is not just any strong candle — it must be breaking structure AND happening at the right time.' },
          { type: 'highlight', title: 'The Base Candle', content: 'Within the Indication, identify the LAST quiet/sideways candle before the explosive move. This is the Base Candle — the candle where institutional orders were placed.\n\nThe Base Candle is your entry zone. Its high becomes your entry for longs (or its low for shorts). This is where unfilled institutional orders remain, waiting for price to return.' },
          { type: 'diagram', id: 'icc' },
        ],
        quiz: [
          { question: 'The Indication phase requires the strong candle to occur during:', options: ['Any time of day', 'A Kill Zone (London or NY session)', 'The Asian session', 'After news events'], correct: 1, explanation: 'The Indication must occur within a Kill Zone (London 06:00-09:00 UTC or NY 11:00-14:00 UTC) to ensure it has institutional backing.' }
        ]
      },
      {
        id: 'lesson-6-2',
        title: 'ICC Phase 2 & 3 — Correction & Continuation',
        duration: '14 min',
        content: [
          { type: 'text', content: 'After the Indication fires, most traders rush to enter immediately. This is wrong. You wait for the Correction — the pullback — and then enter on the Continuation.' },
          { type: 'concept', title: 'Phase 2: Correction', content: 'After the Indication (strong move), price will ALWAYS pull back. This correction:\n• Must retrace at least 30% into the Base Candle zone\n• Must NOT exceed 80% of the Base Candle (if it does, the setup is invalidated)\n• Should have WEAKER candles than the Indication (small bodies, bigger wicks)\n• Can take 1–10 candles to complete\n\nThe correction is the bank "re-filling" at their order zone. The weak candles confirm no new institutional selling — just profit-taking.' },
          { type: 'concept', title: 'Phase 3: Continuation (Break of Character)', content: 'The Continuation is when price breaks back in the original direction:\n• For LONGS: price closes ABOVE the Indication high (Base Candle high)\n• For SHORTS: price closes BELOW the Indication low (Base Candle low)\n• This is your ENTRY — on the CLOSE of the continuation candle\n• Alternatively: place a limit order at the base candle high/low for a better entry' },
          { type: 'formula', title: 'ICC Trade Setup — Complete', content: 'ENTRY: Close of continuation candle (or limit at base candle high)\nSTOP LOSS: Below/above the base candle low/high + small buffer (2-5 pips)\nTARGET: Next liquidity pool (BSL/SSL from IPDA analysis)\nR:R: Minimum 3:1. Ideal 5:1.\n\nMax bars to wait for continuation: 10 candles\nIf no continuation within 10 candles → setup expires, do not enter.' },
          { type: 'example', title: 'Full ICC Example — GBPJPY Long', content: 'Kill Zone: London, 07:15 UTC\nIndication: Strong bullish candle, body 75%, breaks above swing high at 192.50\nBase Candle: Last quiet candle before the move, high = 192.30\nCorrection: Price dips to 192.10 (retrace ~50% of base candle) over 3 candles\nContinuation: 5M candle closes above 192.30 at 08:00 UTC\n\nEntry: 192.32\nSL: 191.80 (below base candle low)\nRisk: 52 pips\nTP: 193.88 (3:1) or 194.40 (5:1)\n\nResult: Price delivers to 194.20 → +188 pips / 3.6R' },
          { type: 'warning', content: 'The most common ICC mistake is entering on the Indication candle itself — before the correction. This gives you a terrible average entry and a huge stop loss. Wait for the correction. Wait for the continuation. Patience is the entire edge.' },
        ],
        quiz: [
          { question: 'What is the minimum required correction (pullback) into the Base Candle zone?', options: ['10%', '30%', '50%', '80%'], correct: 1, explanation: 'The correction must retrace at least 30% into the Base Candle zone. Less than 30% means the pullback was too shallow — institutional orders may not have been fully refilled.' },
          { question: 'Where exactly do you enter a long ICC trade?', options: ['On the Indication candle', 'At the swing low', 'On the close of the continuation candle (or limit at base candle high)', 'After the target is confirmed'], correct: 2, explanation: 'Entry is on the close of the Continuation candle — when price closes above the Base Candle high. This confirms the break of character and institutional resumption of the move.' },
          { question: 'If after 10 candles the continuation has not happened, you should:', options: ['Wait longer', 'Enter anyway', 'Widen your stop', 'Let the setup expire and move on'], correct: 3, explanation: 'ICC setups expire after 10 candles without continuation. A valid setup happens quickly — if it drags on, institutional interest may have moved elsewhere.' }
        ]
      }
    ]
  },
  {
    id: 'module-7',
    title: 'Risk Management — Survival First',
    description: 'The math of not going broke. This module is more important than any setup. No risk management = no trading career.',
    icon: '🛡️',
    color: '#ef4444',
    lessons: [
      {
        id: 'lesson-7-1',
        title: 'The Math of Survival',
        duration: '12 min',
        content: [
          { type: 'text', content: 'Every professional trader will tell you the same thing: the goal of the first year is not to make money. The goal is to not lose money. This sounds wrong — but the math explains it.' },
          { type: 'concept', title: 'Drawdown Recovery Math', content: 'If you lose 10% → need 11% to recover ✓\nIf you lose 20% → need 25% to recover ✓\nIf you lose 30% → need 43% to recover ⚠️\nIf you lose 50% → need 100% to recover ⛔\nIf you lose 70% → need 233% to recover ⛔\n\nThe more you lose, the harder it becomes to recover. This is why capital preservation comes FIRST — always.' },
          { type: 'formula', title: 'The 1% Rule', content: 'Never risk more than 1-2% of your account on a single trade.\n\nAccount: $10,000\n1% risk = $100 per trade\n\nIf you lose 10 trades in a row (worst case):\n$10,000 → $9,044 (only -9.6% drawdown)\n\nVs risking 10% per trade:\n$10,000 → $3,487 after 10 losses (-65% devastation)' },
          { type: 'formula', title: 'Position Size Formula', content: 'Lot Size = (Account × Risk%) / (Stop Loss in pips × Pip Value)\n\nExample:\nAccount: $10,000\nRisk: 1% = $100\nSL: 30 pips\nPair: GBPUSD (pip value = $10 per standard lot)\n\nLot Size = $100 / (30 × $10) = $100 / $300 = 0.33 lots\n\nThis is the ONLY correct way to size positions.' },
          { type: 'highlight', title: 'R:R — Why 3:1 Changes Everything', content: 'At 3:1 R:R, you only need to win 25% of trades to break even.\nAt 3:1, winning 33% means you are profitable.\nAt 3:1, winning 40% means you are doing extremely well.\n\nMost professional traders win only 35-45% of their trades. The edge is in the R:R — not the win rate.' },
          { type: 'example', title: '20 Trades at 3:1 R:R, 35% Win Rate', content: '20 trades × 35% = 7 wins, 13 losses\nEach win = +3R. Each loss = -1R.\n7 wins = +21R\n13 losses = -13R\nNet = +8R\n\nOn a $10,000 account risking 1% ($100/trade):\n+8R = +$800 = +8% return\n\nWith a 35% win rate. The math works IF you maintain 3:1 R:R.' },
          { type: 'warning', content: 'The single most deadly habit in trading is "moving your stop loss" when price approaches it. This turns a 1R loss into a 3R or 5R loss. Your stop loss was placed at a logical level — if price reaches it, the setup was wrong. Accept the loss. Never move a stop against your position.' },
        ],
        quiz: [
          { question: 'If you lose 50% of your account, what return do you need to recover?', options: ['50%', '75%', '100%', '150%'], correct: 2, explanation: 'Losing 50% means your account halved. To double it back to the original value requires a 100% return on the reduced balance.' },
          { question: 'Using 1% risk on a $10,000 account with a 25-pip stop loss on EURUSD, what is the correct lot size?', options: ['0.4 lots', '0.1 lots', '1.0 lots', '0.04 lots'], correct: 0, explanation: '$10,000 × 1% = $100 risk. $100 / (25 pips × $10/pip) = $100/$250 = 0.4 lots.' },
          { question: 'At 3:1 R:R, what minimum win rate do you need to be profitable?', options: ['50%', '40%', '25%', '33%'], correct: 2, explanation: 'At 3:1 R:R, every win = +3R and every loss = -1R. Breaking even: 3W = L → W/(W+L) = 1/4 = 25%. Anything above 25% win rate is profitable at 3:1.' }
        ]
      }
    ]
  },
  {
    id: 'module-8',
    title: 'Trading Psychology',
    description: 'The inner game. This is where most traders fail — not from lack of knowledge, but from lack of emotional discipline.',
    icon: '🧠',
    color: '#a855f7',
    lessons: [
      {
        id: 'lesson-8-1',
        title: 'The Psychological Traps',
        duration: '12 min',
        content: [
          { type: 'text', content: 'You can have the best strategy in the world and still lose money. Trading psychology is not soft advice — it is the hardest technical skill in this profession. The market is specifically designed to exploit your emotional responses.' },
          { type: 'concept', title: 'The 5 Killers', content: 'FOMO (Fear of Missing Out): Entering trades that are not your setup because price is moving fast and you feel left behind. This is how you buy tops and sell bottoms.\n\nREVENGE TRADING: After a loss, immediately taking another trade to "make it back." You are now trading from anger, not analysis.\n\nOVERTRADING: Taking 10 trades when your system produces 2. You are inventing setups that do not exist.\n\nMOVING STOP LOSSES: Refusing to accept a loss, moving the stop further away. Turning a -1R loss into a -5R loss.\n\nPREMATURE TAKE PROFIT: Closing at +1R because you are scared, when your target was +3R. Your winners must offset your losers.' },
          { type: 'highlight', title: 'The Process Mindset', content: 'A professional trader grades their performance on PROCESS, not outcome.\n\nA good trade: Followed all setup rules → valid entry → lost money. Still a GOOD trade.\nA bad trade: Broke rules → got lucky → made money. Still a BAD trade.\n\nIf you only follow your rules, the math takes care of the rest. The goal is consistency of process — not consistency of profit.' },
          { type: 'text', content: 'Keep a grading system for every trade. Grade on: (1) Was the trend correct? (2) Was it in a Kill Zone? (3) Was the ICC setup valid? (4) Was position size correct? (5) Did I follow the entry/exit rules?\n\n5/5 = A. 4/5 = B. 3/5 = C. Below 3/5 = do not take the trade.\n\nOnly A and B trades. This filter alone will transform your results.' },
          { type: 'warning', content: 'After a loss, mandatory 30-minute break. After 2 consecutive losses, done for the day. After 3% account drawdown in one day, done for the week. These are not suggestions — they are rules that protect you from your own worst impulses.' },
        ],
        quiz: [
          { question: 'You took a valid setup, followed all your rules, but the trade hit your stop loss. This trade was:', options: ['A bad trade — you lost money', 'A good trade — you followed your process', 'Average — depends on how much you lost', 'Bad — you should have moved your stop'], correct: 1, explanation: 'A trade that follows all your rules is a GOOD trade regardless of outcome. Process defines quality, not result. Over 100 trades, good processes produce good results.' },
          { question: 'What should you do after 2 consecutive losses?', options: ['Trade more aggressively to recover', 'Stop trading for the day', 'Double position size on the next trade', 'Widen stop losses on next trade'], correct: 1, explanation: 'After 2 consecutive losses, you are likely in an emotional state that impairs decision-making. Stopping for the day protects you from revenge trading and compound losses.' }
        ]
      }
    ]
  },
  {
    id: 'module-9',
    title: 'Your Trading System',
    description: 'Building the complete professional routine: pre-session analysis, execution checklist, journaling, and continuous improvement.',
    icon: '🗂️',
    color: '#64748b',
    lessons: [
      {
        id: 'lesson-9-1',
        title: 'The Professional Routine',
        duration: '15 min',
        content: [
          { type: 'text', content: 'Amateur traders react. Professional traders prepare. The difference between a 2-year losing streak and consistent profitability is often not the strategy — it is the routine around the strategy.' },
          { type: 'concept', title: 'Pre-Session Checklist (30 min before KZ)', content: '1. CHECK THE MACRO\n   • DXY direction on Daily (USD weak = GBP/EUR strong, and vice versa)\n   • Any high-impact news today? (CPI, NFP, FOMC) → check the economic calendar\n   • Are we in a risk-on or risk-off week?\n\n2. MARK THE STRUCTURE (on H4/H1)\n   • Where is the last swing high and low?\n   • Is structure bullish (HH/HL) or bearish (LH/LL)?\n   • Mark BSL above and SSL below\n\n3. IDENTIFY IPDA TARGET\n   • What is the 20-day high and low?\n   • Which liquidity pool was last swept?\n   • Where is price delivering toward?\n\n4. MARK KEY LEVELS\n   • Draw BSL (buy side liquidity target)\n   • Draw SSL (sell side liquidity target)\n   • Note any order blocks or FVGs in the delivery path\n\n5. SET YOUR BIAS\n   • ONE direction only for the session\n   • Write it down: "Today I am LONG biased only"' },
          { type: 'concept', title: 'During the Kill Zone', content: '• Switch to 5M chart\n• Watch for Indication (strong body candle breaking structure)\n• Identify Base Candle\n• Wait for Correction (minimum 30% pullback)\n• Enter on Continuation close\n• Set SL immediately on entry — no exceptions\n• Walk away. Let the trade run.' },
          { type: 'highlight', title: 'The Trade Journal — Your Most Important Tool', content: 'Log every single trade. Every one. Even the ones you did not take.\n\nFor each trade log:\n• Date, pair, direction, timeframe\n• Entry price, SL, TP\n• Kill Zone active? (Y/N)\n• Trend aligned? (Y/N)\n• ICC setup valid? (Y/N)\n• Body ratio of base candle?\n• Result: +R or -R\n• Screenshot of entry\n• What I did right\n• What I did wrong\n\nReview every Sunday. Find patterns in your mistakes. Fix one thing each week.' },
          { type: 'text', content: 'The journal is the feedback loop. Without it, you repeat the same mistakes indefinitely. With it, you improve measurably, week by week. After 100 journaled trades, you will know exactly where your edge is and where you leak money.' },
        ],
        quiz: [
          { question: 'What is the first thing to check in the pre-session routine?', options: ['The 5M chart for setups', 'The macro environment (DXY direction + news)', 'Your trade journal from yesterday', 'What other traders are saying'], correct: 1, explanation: 'Macro first — always. The DXY direction determines your bias for USD pairs. A news event can make a session un-tradeable.' },
          { question: 'Why is keeping a trade journal considered the most important trading tool?', options: ['Brokers require it', 'It provides the feedback loop to identify and fix mistakes over time', 'It helps with taxes', 'Successful traders do not use journals'], correct: 1, explanation: 'The journal is the only way to objectively review your process, find patterns in your mistakes, and improve systematically. Without it, growth is accidental.' }
        ]
      }
    ]
  }
]

export const getTotalLessons = () => CURRICULUM.reduce((acc, mod) => acc + mod.lessons.length, 0)
export const getTotalQuizzes = () => CURRICULUM.reduce((acc, mod) => acc + mod.lessons.reduce((a, l) => a + (l.quiz?.length || 0), 0), 0)
