#!/usr/bin/env python3
"""
Market Prism Blog Generator
Picks the hottest narrative signal from Supabase, generates a forensic article
via Claude, and inserts it into the blog_posts table.

Usage:
  python generate_mp_blog.py                    # auto-picks hottest ticker
  python generate_mp_blog.py --ticker NVDA      # specific ticker
  python generate_mp_blog.py --dry-run          # generate but don't insert
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

import anthropic
from supabase import create_client

# ── CONFIG ───────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]          # service role key for writes
ANTHROPIC_KEY = os.environ["ANTHROPIC_API_KEY"]
MODEL = "claude-sonnet-4-6"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
claude = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

# ── SYSTEM PROMPT ────────────────────────────────────────────────────────────

MP_SYSTEM_PROMPT = """
You are the editorial intelligence behind Market Prism's Intelligence Journal — a forensic 
narrative research platform that publishes institutional-grade market analysis.

VOICE
- Neutral, precise, and forensic — the tone of a senior equity research analyst
- Evidence-first: every claim is anchored to a verifiable data point
- No theatrical language, no hyperbole, no adversarial posturing
- Write like a CFA charterholder who also reads deeply — precise but not dry
- Never sensationalize. Let the data create urgency when it exists.

ARTICLE STRUCTURE — ALWAYS FOLLOW THIS
1. Opening — one paragraph that states the core analytical question clearly. No drama.
2. Narrative context — what story is the market telling about this stock, and where did it originate?
3. Evidence layer — at least 2 quantifiable signals with sources and dates
4. Data table — one structured table with at least 2 positioning/sentiment columns
5. Structural analysis — what does the narrative mechanics tell us about probable price behavior?
6. Key considerations — exactly 4 bullet points framing what an informed investor should watch
7. Closing observation — one definitive sentence. Not a prediction. A structural conclusion.

EVIDENCE STANDARDS
- Every claim must be anchored by a verifiable signal: short interest, options skew, 
  analyst revision direction, revenue trajectory, institutional flow, or insider activity
- Cite sources explicitly: filing type, date, data provider
- Revenue/EPS figures: always state the reporting period
- Forward estimates: label as estimates requiring independent verification
- Never assert narrative direction without naming the signal that demonstrates it

DATA TABLE STANDARDS
Every article includes one data table containing:
- At least 2 columns from: short interest, options skew, analyst revisions, 
  institutional flow, insider activity, valuation vs. historical range
- Source and date for every row
- A plain-English Signal column (Bullish / Bearish / Neutral / Watch)

WHAT YOU NEVER DO
- Never use theatrical or adversarial language
- Never end with a question
- Never write "it remains to be seen" or "in conclusion"
- Never cite internal scoring systems, metrics, or platform names
- Never cite financial figures from memory when live data is provided
- Never build valuation arguments on unverified forward estimates
- Never write "beat expectations" without stating both actual and estimate figures
- Never use emoji or decorative characters
"""

# ── CONTEXT FETCHER ──────────────────────────────────────────────────────────

def get_hottest_ticker() -> dict:
    """Pull the highest-signal ticker from narrative_scorecard."""
    rows = supabase.table("narrative_scorecard") \
        .select("ticker, snapshot_date, verdict, vms, fvd, coordination_score, narrative, energy_remaining, decay_rate") \
        .order("snapshot_date", desc=True) \
        .order("vms", desc=True) \
        .limit(50).execute()

    if not rows.data:
        raise RuntimeError("No data in narrative_scorecard — has the pipeline run today?")

    # Deduplicate to latest per ticker
    seen = set()
    candidates = []
    for row in rows.data:
        t = row["ticker"]
        if t not in seen:
            seen.add(t)
            candidates.append(row)

    # Prefer high energy + strong verdict signal
    def score(r):
        s = 0
        if r.get("verdict") in ("Narrative Trap", "Structurally Supported"):
            s += 3
        energy = r.get("energy_remaining") or 0
        s += min(energy / 25, 4)   # up to 4 points for energy
        coord = r.get("coordination_score") or 0
        s += min(coord / 25, 3)    # up to 3 points for coordination
        return s

    best = sorted(candidates, key=score, reverse=True)[0]
    print(f"  → Selected: {best['ticker']} | verdict: {best.get('verdict')} | energy: {best.get('energy_remaining')}")
    return best


def get_ticker_context(ticker: str) -> dict:
    """Pull full context from narrative_scorecard + v_trade_cards."""
    sc = supabase.table("narrative_scorecard") \
        .select("*").eq("ticker", ticker) \
        .order("snapshot_date", desc=True) \
        .limit(1).execute()

    tc = supabase.table("v_trade_cards") \
        .select("*").eq("ticker", ticker) \
        .order("snapshot_date", desc=True) \
        .limit(1).execute()

    scorecard = sc.data[0] if sc.data else {}
    card = tc.data[0] if tc.data else {}

    return {
        "ticker": ticker,
        "snapshot_date": scorecard.get("snapshot_date", ""),
        "verdict": scorecard.get("verdict", ""),
        "narrative": scorecard.get("narrative", ""),
        "energy_remaining": scorecard.get("energy_remaining"),
        "decay_rate": scorecard.get("decay_rate"),
        "coordination_score": scorecard.get("coordination_score"),
        "coordination_class": scorecard.get("coordination_class", ""),
        "fvd": scorecard.get("fvd"),
        "vms": scorecard.get("vms"),
        "suspicion_score": scorecard.get("suspicion_score"),
        "primary_label": card.get("primary_label", ""),
        "direction": card.get("direction", ""),
        "confidence": card.get("confidence"),
        "holding_days": card.get("holding_days"),
        "price": card.get("price"),
        "description": card.get("description", ""),
        "phase": card.get("phase", ""),
        "rarity": card.get("rarity", ""),
        "trade_score": card.get("trade_score"),
    }


def get_live_data(ticker: str) -> dict:
    """Pull live price + news from yfinance."""
    try:
        import yfinance as yf
        t = yf.Ticker(ticker)
        info = t.info or {}
        news = t.news or []

        price = info.get("currentPrice") or info.get("regularMarketPrice")
        prev = info.get("regularMarketPreviousClose")
        chg_pct = round(((price - prev) / prev) * 100, 2) if price and prev else None

        headlines = []
        for n in news[:5]:
            content = n.get("content", {})
            title = content.get("title") or n.get("title", "")
            link = (content.get("canonicalUrl", {}).get("url") or n.get("link", ""))
            pub = content.get("provider", {}).get("displayName") or n.get("publisher", "")
            if title:
                headlines.append({"title": title, "publisher": pub, "link": link})

        return {
            "price": price,
            "change_pct": chg_pct,
            "market_cap_bn": round(info.get("marketCap", 0) / 1e9, 1) if info.get("marketCap") else None,
            "pe_trailing": info.get("trailingPE"),
            "short_pct_float": round(info.get("shortPercentOfFloat", 0) * 100, 2) if info.get("shortPercentOfFloat") else None,
            "return_52w_pct": round(info.get("52WeekChange", 0) * 100, 1) if info.get("52WeekChange") else None,
            "revenue_ttm_bn": round(info.get("totalRevenue", 0) / 1e9, 2) if info.get("totalRevenue") else None,
            "headlines": headlines,
        }
    except Exception as e:
        print(f"  ⚠ Live data fetch failed: {e}")
        return {}


# ── IMAGE GENERATOR ──────────────────────────────────────────────────────────

def generate_article_image(ticker: str, title: str, excerpt: str, slug: str) -> str | None:
    """
    Generate a header image via DALL-E 3, download it, upload to Supabase Storage,
    and return the permanent public URL. DALL-E URLs expire in ~1hr so we never
    store them directly.
    Requires OPENAI_API_KEY in environment.
    """
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        print("  ⚠ OPENAI_API_KEY not set — skipping image generation")
        return None

    try:
        import requests as req_lib

        # Step 1: Claude writes the image prompt
        prompt_response = claude.messages.create(
            model=MODEL,
            max_tokens=200,
            system=(
                "You write image generation prompts for a bold financial intelligence publication. "
                "Style references: editorial mixed-media collage, conceptual photography, striking visual metaphors. "
                "Think: textured surfaces, bold single-color accent pops (vivid yellow, deep red, electric blue, etc.), "
                "gritty realism, halftone/risograph overlays, ink splatter, geometric shapes, photojournalistic drama. "
                "People ARE allowed — use symbolic figures (suited executives, traders, silhouettes) when thematically relevant. "
                "Vary compositions: sometimes close-up hands/objects, sometimes wide cinematic scenes, sometimes collage mashups. "
                "Each image MUST feel unique — never repeat the same dark-abstract-data look. "
                "Match the visual metaphor to the article's specific narrative (e.g. trade war = flags + handshakes, "
                "manipulation = blindfolds + hidden eyes, momentum = speed/motion blur). "
                "NO generic stock chart imagery, NO line graphs, NO candlestick patterns. "
                "Output ONLY the DALL-E prompt, max 120 words."
            ),
            messages=[{"role": "user", "content": (
                "Write a DALL-E 3 prompt for an article header image.\n"
                f"Full article title: \"{title}\"\n"
                f"Ticker: {ticker}\n"
                f"Excerpt: {excerpt[:300]}\n"
                "Create a vivid, conceptual visual metaphor that captures the specific story — not generic finance imagery."
            )}],
        )
        image_prompt = prompt_response.content[0].text.strip()
        print(f"  → Image prompt: {image_prompt[:80]}...")

        # Step 2: DALL-E 3 renders it
        response = req_lib.post(
            "https://api.openai.com/v1/images/generations",
            headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
            json={"model": "dall-e-3", "prompt": image_prompt, "n": 1, "size": "1792x1024", "quality": "hd", "style": "vivid"},
            timeout=60,
        )
        response.raise_for_status()
        dalle_url = response.json()["data"][0]["url"]
        print(f"  ✓ Image generated from DALL-E")

        # Step 3: Download the image bytes (DALL-E URLs expire in ~1hr)
        img_bytes = req_lib.get(dalle_url, timeout=30).content
        print(f"  ✓ Image downloaded ({len(img_bytes):,} bytes)")

        # Step 4: Upload to Supabase Storage bucket 'blog-images'
        # Must use service role key — anon key lacks storage write permissions
        service_key = os.environ.get("SUPABASE_SERVICE_KEY") or SUPABASE_KEY
        filename = slug + ".png"
        storage_path = filename

        upload_url = SUPABASE_URL + "/storage/v1/object/blog-images/" + storage_path
        upload_res = req_lib.post(
            upload_url,
            headers={
                "Authorization": "Bearer " + service_key,
                "apikey": service_key,
                "Content-Type": "image/png",
                "x-upsert": "true",
            },
            data=img_bytes,
            timeout=30,
        )

        if upload_res.status_code not in (200, 201):
            print(f"  ⚠ Storage upload failed: {upload_res.status_code} {upload_res.text[:200]}")
            # Fall back to storing dalle URL directly (short-lived but better than nothing)
            print(f"  → Falling back to DALL-E URL (will expire)")
            return dalle_url

        # Step 5: Build permanent public URL
        public_url = SUPABASE_URL + "/storage/v1/object/public/blog-images/" + storage_path
        print(f"  ✓ Image uploaded to Supabase Storage: {public_url}")
        return public_url

    except Exception as e:
        print(f"  ⚠ Image generation failed: {e}")
        return None


# ── ARTICLE GENERATOR ─────────────────────────────────────────────────────────

def generate_topic_article(topic: str) -> tuple[str, str]:
    """
    Generate a free-form educational/analytical article on any market topic.
    No ticker or live data required.
    """
    print(f"  → Calling Claude for topic article: '{topic}'...")
    response = claude.messages.create(
        model=MODEL,
        max_tokens=3000,
        system=MP_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"""
MARKET PRISM ARTICLE GENERATION REQUEST
========================================
TYPE: Educational / Analytical
TOPIC: {topic}
DATE: {datetime.now().strftime("%B %d, %Y")}

Write a forensic market intelligence article on the topic above.
Follow your 7-part structure. 800-1000 words.
The article should be educational and data-grounded — use real historical examples,
named regulatory cases, documented market events, or academic research where relevant.
Do not use internal scores or platform names.
Do not use emoji or decorative characters.

Output the article title on the first line as: ## [Title Here]
Then the article body. Nothing else.
"""}],
    )
    full = response.content[0].text.strip()
    title = topic  # fallback
    for line in full.split("\n"):
        if line.startswith("## "):
            title = line.lstrip("# ").strip()
            break
    body_lines = [l for l in full.split("\n") if not l.strip().startswith("## ")]
    body = "\n".join(body_lines).strip()
    print(f"  → Title: {title}")
    print(f"  → Article: {len(body)} chars")
    return title, body


def build_prompt(ctx: dict, live: dict, sentiment: str = None) -> str:
    headlines_str = ""
    for h in live.get("headlines", []):
        pub = f" [{h['publisher']}]" if h.get("publisher") else ""
        link = f"\n     URL: {h['link']}" if h.get("link") else ""
        headlines_str += f"  - {h['title']}{pub}{link}\n"

    # Translate internal signals to writer-friendly language
    verdict = ctx.get("verdict", "")
    energy = ctx.get("energy_remaining") or 0
    decay = ctx.get("decay_rate") or 0
    coordination = ctx.get("coordination_class", "")
    fvd = ctx.get("fvd") or 0
    label = ctx.get("primary_label", "")
    direction = ctx.get("direction", "")
    confidence = ctx.get("confidence") or 0
    holding_days = ctx.get("holding_days") or 0

    # Translate verdict to writer-friendly signal direction
    if verdict == "Narrative Trap":
        signal_direction = f"the dominant narrative shows signs of structural fragility — price may be running ahead of fundamentals"
    elif verdict == "Structurally Supported":
        signal_direction = f"the narrative has fundamental backing and momentum is technically intact"
    else:
        signal_direction = f"the narrative structure is in transition"

    # Energy/decay framing
    if energy > 70:
        energy_framing = "narrative energy is high — the story still has momentum"
    elif energy > 40:
        energy_framing = "narrative energy is moderating — early signs of fatigue"
    else:
        energy_framing = "narrative energy is low — the thesis is losing traction"

    # FVD framing (fair value deviation as % — positive = above fair value)
    if fvd and abs(fvd) > 20:
        fvd_framing = f"significant valuation dislocation detected ({fvd:+.1f}% from estimated fair value)"
    elif fvd:
        fvd_framing = f"modest valuation gap ({fvd:+.1f}% from estimated fair value)"
    else:
        fvd_framing = "valuation gap data unavailable"

    price_str = f"${live['price']:,.2f}" if live.get("price") else "N/A"
    chg_str = f"{live['change_pct']:+.2f}%" if live.get("change_pct") is not None else "N/A"
    mkt_cap = f"${live['market_cap_bn']:.1f}B" if live.get("market_cap_bn") else "N/A"
    short_pct = f"{live['short_pct_float']:.2f}%" if live.get("short_pct_float") else "N/A"
    ret_52w = f"{live['return_52w_pct']:+.1f}%" if live.get("return_52w_pct") is not None else "N/A"
    rev = f"${live['revenue_ttm_bn']:.2f}B" if live.get("revenue_ttm_bn") else "N/A"
    pe = f"{live['pe_trailing']:.1f}x" if live.get("pe_trailing") else "N/A"

    # Sentiment direction line
    if sentiment == "bull":
        sentiment_str = "BULLISH — lead with supporting evidence, frame risks as secondary considerations"
    elif sentiment == "bear":
        sentiment_str = "BEARISH — weight counterevidence more heavily, probe the bull case forensically"
    else:
        sentiment_str = "AUTO — follow the evidence wherever it leads"

    return f"""
MARKET PRISM ARTICLE GENERATION REQUEST
========================================
TICKER: {ctx['ticker']}
DATE: {datetime.now().strftime("%B %d, %Y")}
SNAPSHOT DATE: {ctx.get('snapshot_date', '')}

NARRATIVE INTELLIGENCE (do not cite these as scores or system metrics in the article)
--------------------------------------------------------------------------------------
Signal direction: {signal_direction}
Narrative description: {ctx.get('narrative', 'N/A')}
Energy status: {energy_framing}
Coordination pattern: {coordination if coordination else 'None detected'}
Valuation context: {fvd_framing}
Trade signal: {label.replace('_', ' ').title()} ({direction}) — {confidence*100:.0f}% confidence, {holding_days}-day window
Phase: {ctx.get('phase', 'N/A')}

LIVE MARKET DATA (use these exact figures)
-------------------------------------------
Price:           {price_str} ({chg_str} today)
Market cap:      {mkt_cap}
P/E (trailing):  {pe}
Short % float:   {short_pct}
52-week return:  {ret_52w}
Revenue (TTM):   {rev}

RECENT NEWS HEADLINES
---------------------
{headlines_str if headlines_str else '  No headlines retrieved.'}

INSTRUCTIONS
------------
SENTIMENT DIRECTION: {sentiment_str}
Write a forensic market intelligence article about {ctx['ticker']} following your 
7-part structure. 800-1000 words.

The article must:
- Open with the core analytical question about {ctx['ticker']} — no drama
- Explain what narrative is driving price action and where it originated
- Include at least 2 quantifiable evidence signals (use short % float and 52w return above)
- Include one data table with source, date, and Signal column
- Analyze what the narrative structure implies about probable price behavior
- End with exactly 4 key considerations and one definitive closing sentence

Do NOT mention scores, ratings, internal metrics, or Market Prism by name in the article.
Translate all signal intelligence into plain analytical language.
Do NOT use emoji or decorative characters.
Do NOT construct URLs — only use URLs provided in the headlines above.

Output the article title on the first line as: ## [Title Here]
Then the article body. Nothing else.
"""


def generate_article(ctx: dict, live: dict, sentiment: str = None) -> tuple[str, str]:
    """Returns (title, article_html_as_markdown)."""
    prompt = build_prompt(ctx, live, sentiment=sentiment)

    print(f"  → Calling Claude ({MODEL})...")
    response = claude.messages.create(
        model=MODEL,
        max_tokens=3000,
        system=MP_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    full = response.content[0].text.strip()

    # Extract title
    title = f"{ctx['ticker']} — Narrative Intelligence Brief"
    for line in full.split("\n"):
        if line.startswith("## "):
            title = line.lstrip("# ").strip()
            break

    # Strip the title line from body
    body_lines = [l for l in full.split("\n") if not l.strip().startswith("## ")]
    body = "\n".join(body_lines).strip()

    print(f"  → Title: {title}")
    print(f"  → Article: {len(body)} chars")
    return title, body


# ── SLUG GENERATOR ────────────────────────────────────────────────────────────

def slugify(title: str) -> str:
    s = title.lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s[:80].strip("-")


# ── SUPABASE PUBLISHER ────────────────────────────────────────────────────────

def publish_to_supabase(ticker: str, title: str, body: str, ctx: dict, dry_run: bool = False, **kwargs) -> dict:
    slug = slugify(title)
    # Ensure slug uniqueness with date prefix
    date_prefix = datetime.now().strftime("%Y-%m-%d")
    slug = f"{date_prefix}-{slug}"

    # Map verdict to tag
    verdict = ctx.get("verdict", "")
    tag_map = {
        "Narrative Trap": "Market Intel",
        "Structurally Supported": "Research",
        "Monitoring": "Research",
    }
    tag = tag_map.get(verdict, "Market Intel")

    # Excerpt: first non-empty non-header line
    excerpt = ""
    for line in body.split("\n"):
        stripped = line.strip().lstrip("#").strip()
        if stripped and not stripped.startswith("|"):
            excerpt = stripped[:200]
            break

    row = {
        "ticker": ticker,
        "slug": slug,
        "title": title,
        "body": body,
        "excerpt": excerpt,
        "tag": tag,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "author": "Market Prism Research",
        "status": "published",
        "image_url": kwargs.get("image_url") or "",
    }

    if dry_run:
        print(f"\n  [DRY RUN] Would insert:")
        print(json.dumps({k: v[:80] if isinstance(v, str) and len(v) > 80 else v for k, v in row.items()}, indent=2))
        return {"success": True, "dry_run": True, "slug": slug}

    result = supabase.table("blog_posts").insert(row).execute()
    if result.data:
        print(f"  ✓ Inserted into blog_posts: {slug}")
        return {"success": True, "slug": slug, "id": result.data[0].get("id")}
    else:
        print(f"  ✗ Insert failed: {result}")
        return {"success": False}


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Market Prism Blog Generator")
    parser.add_argument("--ticker", help="Specific ticker (auto-picked if omitted)")
    parser.add_argument("--sentiment", choices=["bull", "bear", "auto"], default="auto",
                        help="Story angle: bull, bear, or auto (derived from signal)")
    parser.add_argument("--topic", help="Free-form topic e.g. 'How to Spot Market Manipulation' — bypasses ticker logic entirely")
    parser.add_argument("--dry-run", action="store_true", help="Generate but don't insert into Supabase")
    args = parser.parse_args()

    print("\n[Market Prism Blog Generator]")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M ET')}\n")

    # ── TOPIC MODE: free-form article, no ticker required ──────────────────
    if args.topic:
        print(f"[1/4] Topic mode: '{args.topic}'")
        title, body = generate_topic_article(args.topic)
        ticker = "MP"
        ctx = {"verdict": "Research", "ticker": "MP"}

    else:
        # ── TICKER MODE ────────────────────────────────────────────────────
        # 1. Pick ticker
        if args.ticker:
            ticker = args.ticker.upper()
            print(f"[1/4] Using specified ticker: {ticker}")
            ctx = get_ticker_context(ticker)
        else:
            print("[1/4] Selecting hottest ticker from narrative_scorecard...")
            best = get_hottest_ticker()
            ticker = best["ticker"]
            ctx = get_ticker_context(ticker)

        # 2. Live data
        print(f"[2/4] Fetching live data for {ticker}...")
        live = get_live_data(ticker)
        if live.get("price"):
            print(f"  ✓ Price: ${live['price']:,.2f} ({live.get('change_pct', 0):+.2f}%)")

        # 3. Generate
        sentiment = args.sentiment if args.sentiment != "auto" else None
        print(f"[3/4] Generating article (sentiment: {args.sentiment})...")
        title, body = generate_article(ctx, live, sentiment=sentiment)

    # 4. Generate image
    image_url = None
    if os.environ.get("OPENAI_API_KEY"):
        print(f"[4/5] Generating header image...")
        image_url = generate_article_image(ticker, title, body[:300], slug=slugify(title))
    else:
        print(f"[4/5] Skipping image (OPENAI_API_KEY not set)")

    # 5. Publish
    print(f"[5/5] Publishing to Supabase {'(dry run)' if args.dry_run else ''}...")
    result = publish_to_supabase(ticker, title, body, ctx, dry_run=args.dry_run, image_url=image_url)

    if result.get("success"):
        print(f"\n✓ Done. Slug: {result['slug']}\n")
        # Write slug to file for downstream steps (e.g. indexing ping)
        slug_file = os.environ.get("GITHUB_OUTPUT", "")
        if slug_file:
            with open(slug_file, "a") as f:
                f.write(f"slug={result['slug']}\n")
                f.write(f"dry_run={'true' if args.dry_run else 'false'}\n")
    else:
        print(f"\n✗ Failed.\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
