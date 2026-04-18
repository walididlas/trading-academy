"""
Claude AI assistant endpoint — injects live TradingView context then answers.
"""
import os
import anthropic
from tradingview import get_quote, in_kill_zone, kill_zone_name
from datetime import datetime, timezone

SYSTEM_PROMPT = """You are a professional AI trading assistant specialising in the ICC (Indication/Correction/Continuation) Kill Zone method — a fusion of ICT (Inner Circle Trader) concepts with TradesBySci execution rules.

Your student's trading system:
• Pairs: GBPUSD, GBPJPY, EURUSD
• Timeframe: H1 for signals, M15 for entry refinement
• Kill Zones: London (06:00–09:00 UTC) and New York (11:00–14:00 UTC) only
• Trend filter: EMA50 on H1 — only longs above EMA50, shorts below
• Base Candle: must have ≥60% body-to-range ratio in trend direction
• Correction: price must retrace ≥30% into the base candle before entry
• Continuation: enter when price closes beyond the base candle's high/low
• Stop Loss: just below/above the base candle + 2 pips buffer
• Risk:Reward: minimum 2.5:1, target 3:1+
• Risk per trade: maximum 1-2% of account
• Daily max loss: 2 consecutive losses = stop trading for the day
• Weekly drawdown limit: 3%

ICT concepts you apply:
• BSL/SSL (Buy-Side / Sell-Side Liquidity) pools as targets
• IPDA 20-day price delivery targets
• Order Blocks (OB) as areas of institutional interest
• Fair Value Gaps (FVG/Imbalance) as magnets
• Premium/Discount zones (above/below 50% equilibrium)
• Displacement candles as evidence of institutional intent
• Market Structure: Higher Highs/Higher Lows (bullish), Lower Highs/Lower Lows (bearish)

When analyzing a trade setup, always check:
1. Is price in a Kill Zone right now?
2. What is the EMA50 trend on H1?
3. Has there been a valid base candle (≥60% body)?
4. Has price corrected ≥30% into the base candle?
5. Has continuation broken out?
6. What is the R:R if you enter now?
7. Where is the nearest BSL/SSL for the TP target?

Be direct, specific, and mentor-like. Give actionable advice. Never be vague.
When you have live chart data, reference exact price levels. When grading a trade, be honest — if it breaks the rules, say so clearly and explain why.

Format your responses cleanly. Use bullet points for checklist-style analysis. Use "✅" for passed checks and "❌" for failed ones."""


async def chat(message: str, history: list[dict]) -> str:
    """Process a chat message and return the assistant's reply."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return "⚠️ ANTHROPIC_API_KEY not set. Add it to your .env file in the backend folder."

    client = anthropic.Anthropic(api_key=api_key)

    # Build context string with live data
    utc_now = datetime.now(timezone.utc)
    utc_str = utc_now.strftime("%H:%M UTC")
    kz = kill_zone_name()
    context_lines = [
        f"Current UTC time: {utc_str}",
        f"Kill Zone status: {kz + ' — ACTIVE' if kz else 'No Kill Zone active'}",
    ]

    # Try to inject live quote if question seems chart-related
    keywords = ["chart", "setup", "price", "level", "trade", "analyze", "current", "now", "gbp", "eur", "jpy"]
    if any(k in message.lower() for k in keywords):
        try:
            for sym in ["GBPUSD", "GBPJPY", "EURUSD"]:
                if sym.lower() in message.lower() or sym[:3].lower() in message.lower():
                    q = await get_quote(sym)
                    if "error" not in q:
                        context_lines.append(f"{sym}: {q.get('last', 'N/A')}")
        except Exception:
            pass

    live_context = "\n".join(context_lines)
    system_with_context = SYSTEM_PROMPT + f"\n\n--- LIVE CONTEXT ---\n{live_context}\n---"

    # Convert history to Anthropic format
    messages = []
    for msg in history[-10:]:
        role = "user" if msg.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("content", "")})

    # Add the new user message
    messages.append({"role": "user", "content": message})

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system_with_context,
            messages=messages,
        )
        return response.content[0].text
    except anthropic.AuthenticationError:
        return "⚠️ Invalid API key. Check your ANTHROPIC_API_KEY in the .env file."
    except anthropic.RateLimitError:
        return "⚠️ Rate limit hit. Wait a moment and try again."
    except Exception as e:
        return f"⚠️ Error from Claude API: {str(e)}"
