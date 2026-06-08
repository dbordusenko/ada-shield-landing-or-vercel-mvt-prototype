const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');

const app = express();
app.use(express.json());

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[telegram] Skipped — no credentials set');
    return;
  }
  const chunks = splitMessage(text);
  for (const chunk of chunks) {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: chunk,
          parse_mode: 'Markdown',
        }),
      });
    } catch (err) {
      console.error('[telegram] Send error:', err.message);
    }
  }
}

// Telegram has 4096 char limit per message
function splitMessage(text, limit = 4000) {
  const parts = [];
  while (text.length > limit) {
    const cut = text.lastIndexOf('\n', limit);
    parts.push(text.slice(0, cut > 0 ? cut : limit));
    text = text.slice(cut > 0 ? cut : limit);
  }
  parts.push(text);
  return parts;
}

// ─── Forum Scraper Agent ──────────────────────────────────────────────────────

async function forumScraperAgent(topic = 'construction finance automation') {
  const sources = await Promise.all([
    scrapeReddit(topic),
    scrapeHackerNews(topic),
    scrapeHackerNewsAsk(topic),
    scrapeProductHunt(),
  ]);
  return sources.flat();
}

async function scrapeReddit(topic) {
  const subs = ['entrepreneur', 'SaaS', 'smallbusiness', 'startups', 'Accounting', 'construction'];
  const posts = [];
  for (const sub of subs) {
    try {
      const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(topic)}&sort=hot&limit=10&t=week`;
      const res = await fetch(url, { headers: { 'User-Agent': 'agent-market-bot/1.0' } });
      const json = await res.json();
      for (const item of (json?.data?.children ?? [])) {
        const d = item.data;
        posts.push({ source: 'reddit', title: d.title, text: d.selftext?.slice(0, 600) || '', score: d.score, comments: d.num_comments });
      }
    } catch (_) {}
  }
  return posts;
}

async function scrapeHackerNews(topic) {
  try {
    const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=15`);
    const json = await res.json();
    return (json.hits ?? []).map(h => ({ source: 'hackernews', title: h.title, text: h.story_text?.slice(0, 600) || '', score: h.points, comments: h.num_comments }));
  } catch (_) { return []; }
}

async function scrapeHackerNewsAsk(topic) {
  try {
    const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=ask_hn&hitsPerPage=10`);
    const json = await res.json();
    return (json.hits ?? []).map(h => ({ source: 'hackernewsask', title: h.title, text: h.story_text?.slice(0, 600) || '', score: h.points, comments: h.num_comments }));
  } catch (_) { return []; }
}

async function scrapeProductHunt() {
  try {
    const query = `{ posts(first: 10, order: VOTES) { edges { node { name tagline votesCount url } } } }`;
    const res = await fetch('https://www.producthunt.com/frontend/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    return (json?.data?.posts?.edges ?? []).map(e => ({ source: 'producthunt', title: e.node.name, text: e.node.tagline, score: e.node.votesCount, comments: 0 }));
  } catch (_) { return []; }
}

// ─── Idea Generator Agent ─────────────────────────────────────────────────────

async function ideaGeneratorAgent(forumPosts) {
  const digest = forumPosts.slice(0, 30).map(p => `[${p.source}] "${p.title}" — ${p.text} (score: ${p.score})`).join('\n');

  const msg = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `You are a market research analyst specializing in B2B SaaS and AI agents.

Forum data:
${digest}

Generate 5 specific AI agent product ideas based on real pain points visible in this data.

For EACH idea provide ALL fields with substantive content (no empty strings):
{
  "name": "Product name",
  "agent_type": "specific type of agent",
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "build_complexity": "LOW" | "MEDIUM" | "HIGH",
  "confidence_score": <0-100>,
  "problem": "Exact pain point in one sentence",
  "icp": "Job title + company type + company size",
  "current_workaround": "How users solve this manually today",
  "market_signal": "Why this is validated now",
  "sources": ["source1", "source2"]
}

build_complexity rules: LOW=single integration/simple parsing, MEDIUM=multi-step/2-3 integrations, HIGH=complex orchestration/deep ERP/real-time.

Respond as JSON array only. Every field must be non-empty.`,
    }],
  });

  try {
    return JSON.parse(msg.content[0].text.replace(/```json|```/g, '').trim());
  } catch (_) { return []; }
}

// ─── Validator Agent ──────────────────────────────────────────────────────────

async function validatorAgent(ideas) {
  const msg = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are an adversarial product critic.

Ideas:
${JSON.stringify(ideas, null, 2)}

For each idea add:
- "risk": main failure risk (one specific sentence)
- "verdict": "ship" | "pivot" | "kill"
- "adjusted_confidence": honest 0-100 score (most ideas deserve 60-80, not 90+)

Also fill in any empty icp, current_workaround, market_signal, build_complexity fields.

Return full array as JSON only.`,
    }],
  });

  try {
    return JSON.parse(msg.content[0].text.replace(/```json|```/g, '').trim());
  } catch (_) { return ideas; }
}

// ─── Ticket Formatter ─────────────────────────────────────────────────────────

function formatReport(ideas, date) {
  const dateStr = date.toISOString().slice(0, 10);
  const shippable = ideas.filter(i => i.verdict !== 'kill' && i.adjusted_confidence >= 80);

  const header = `🛠 DEV PIPELINE UPDATE — ${dateStr}\nAgent Store: New Opportunities Validated\nTimestamp: ${date.toISOString()}\n────────────────────────────────`;

  if (shippable.length === 0) {
    return `${header}\n\n⚠️ No confirmed problems today. Minimum source threshold not met.\nAction: No new tickets created. Monitor running normally.`;
  }

  const tickets = shippable.map((idea, idx) => {
    const ticketId = `AGT-${dateStr}-${String(idx + 1).padStart(3, '0')}`;
    const priorityIcon = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🟢' }[idea.priority] || '🔴';
    return `
══════════════════════════════
🎫 TICKET: ${ticketId}
──────────────────────────────
Title: ${idea.name}
Agent Type: ${idea.agent_type}
Priority: ${priorityIcon} ${idea.priority}
Build Complexity: ${idea.build_complexity || 'MEDIUM'}
Confidence Score: ${idea.adjusted_confidence}/100

📝 Problem:
${idea.problem}

🎯 ICP: ${idea.icp}
⚠️ Current workaround: ${idea.current_workaround}
📊 Market signal: ${idea.market_signal}
⚡ Risk: ${idea.risk}

🔗 Sources: ${(idea.sources || []).join(', ')}

Status: 🆕 NEW — Awaiting prioritization`;
  });

  return `${header}\n\n📋 ${shippable.length} NEW TICKET(S) CREATED\n${tickets.join('\n')}\n\n────────────────────────────────\nAuto-generated by Agent Market Monitor\nOnly problems with independent cross-validation included`;
}

// ─── Pipeline Orchestrator ────────────────────────────────────────────────────

const TOPIC = process.env.SCAN_TOPIC || 'construction finance automation';

async function runPipeline() {
  const now = new Date();
  console.log(`[orchestrator] Starting pipeline at ${now.toISOString()}`);

  const posts = await forumScraperAgent(TOPIC);
  console.log(`[forum-scraper] ${posts.length} posts found`);

  if (posts.length < 5) {
    const report = `🛠 DEV PIPELINE UPDATE — ${now.toISOString().slice(0, 10)}\nAgent Store: New Opportunities Validated\nTimestamp: ${now.toISOString()}\n────────────────────────────────\n\n⚠️ No confirmed problems today. Minimum source threshold not met.\nAction: No new tickets created. Monitor running normally.`;
    console.log('[orchestrator] Not enough posts, skipping AI pass');
    await sendTelegram(report);
    return { posts_analyzed: posts.length, ideas: [], report };
  }

  const ideas = await ideaGeneratorAgent(posts);
  console.log(`[idea-generator] ${ideas.length} ideas generated`);

  const validated = await validatorAgent(ideas);
  console.log(`[validator] ${validated.filter(i => i.verdict === 'ship').length} ideas passed`);

  const report = formatReport(validated, now);
  console.log('[orchestrator] Sending to Telegram...');
  await sendTelegram(report);
  console.log('[orchestrator] Done');

  return { posts_analyzed: posts.length, ideas: validated, report };
}

// ─── Scheduler (runs at 9:00 and 10:00 UTC) ──────────────────────────────────

function scheduleRuns() {
  const RUN_HOURS = (process.env.RUN_HOURS || '9,10').split(',').map(Number);

  setInterval(() => {
    const now = new Date();
    if (RUN_HOURS.includes(now.getUTCHours()) && now.getUTCMinutes() === 0) {
      console.log(`[scheduler] Triggering pipeline at ${now.toISOString()}`);
      runPipeline().catch(err => console.error('[scheduler] Pipeline error:', err.message));
    }
  }, 60 * 1000); // check every minute

  console.log(`[scheduler] Watching for UTC hours: ${RUN_HOURS.join(', ')}`);
}

// ─── API Routes ───────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ status: 'ok', topic: TOPIC }));

app.get('/run', async (req, res) => {
  try {
    const result = await runPipeline();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/report', async (req, res) => {
  try {
    const result = await runPipeline();
    res.type('text').send(result.report);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`agent-market-site running on port ${PORT}`);
  scheduleRuns();
});
