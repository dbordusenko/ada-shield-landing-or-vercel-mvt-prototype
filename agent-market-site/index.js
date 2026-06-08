const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');

const app = express();
app.use(express.json());

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Forum Scraper Agent ──────────────────────────────────────────────────────

async function forumScraperAgent(topic = 'automation software tools') {
  const sources = await Promise.all([
    scrapeReddit(topic),
    scrapeHackerNews(topic),
    scrapeHackerNewsAsk(topic),
    scrapeProductHunt(),
  ]);
  return sources.flat();
}

async function scrapeReddit(topic) {
  const subs = ['entrepreneur', 'SaaS', 'smallbusiness', 'startups', 'Accounting'];
  const posts = [];
  for (const sub of subs) {
    try {
      const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(topic)}&sort=hot&limit=10&t=week`;
      const res = await fetch(url, { headers: { 'User-Agent': 'agent-market-bot/1.0' } });
      const json = await res.json();
      for (const item of (json?.data?.children ?? [])) {
        const d = item.data;
        posts.push({
          source: 'reddit',
          title: d.title,
          text: d.selftext?.slice(0, 600) || '',
          score: d.score,
          comments: d.num_comments,
          url: `https://reddit.com${d.permalink}`,
        });
      }
    } catch (_) {}
  }
  return posts;
}

async function scrapeHackerNews(topic) {
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=15`;
    const res = await fetch(url);
    const json = await res.json();
    return (json.hits ?? []).map(h => ({
      source: 'hackernews',
      title: h.title,
      text: h.story_text?.slice(0, 600) || '',
      score: h.points,
      comments: h.num_comments,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    }));
  } catch (_) { return []; }
}

async function scrapeHackerNewsAsk(topic) {
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=ask_hn&hitsPerPage=10`;
    const res = await fetch(url);
    const json = await res.json();
    return (json.hits ?? []).map(h => ({
      source: 'hackernewsask',
      title: h.title,
      text: h.story_text?.slice(0, 600) || '',
      score: h.points,
      comments: h.num_comments,
      url: `https://news.ycombinator.com/item?id=${h.objectID}`,
    }));
  } catch (_) { return []; }
}

async function scrapeProductHunt() {
  try {
    const url = 'https://www.producthunt.com/frontend/graphql';
    const query = `{ posts(first: 10, order: VOTES) { edges { node { name tagline votesCount url } } } }`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    return (json?.data?.posts?.edges ?? []).map(e => ({
      source: 'producthunt',
      title: e.node.name,
      text: e.node.tagline,
      score: e.node.votesCount,
      comments: 0,
      url: e.node.url,
    }));
  } catch (_) { return []; }
}

// ─── Idea Generator Agent ─────────────────────────────────────────────────────

async function ideaGeneratorAgent(forumPosts) {
  const digest = forumPosts
    .slice(0, 30)
    .map(p => `[${p.source}] "${p.title}" — ${p.text} (score: ${p.score})`)
    .join('\n');

  const msg = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: `You are a market research analyst specializing in B2B SaaS and AI agents.

Forum data:
${digest}

Generate 5 specific AI agent product ideas based on real pain points visible in this data.

For EACH idea you MUST provide ALL fields with substantive content (no empty strings):

{
  "name": "Product name",
  "agent_type": "specific type of AI agent (e.g. document processing agent, outreach automation agent)",
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "build_complexity": "LOW" | "MEDIUM" | "HIGH",
  "confidence_score": <number 0-100>,
  "problem": "One clear sentence describing the exact pain point",
  "icp": "Specific job title + company type + company size (e.g. Project controllers at mid-market construction firms $10M-$100M revenue)",
  "current_workaround": "How users solve this today manually (be specific)",
  "market_signal": "Why this is validated now — market size, trend, regulation, or competitive gap",
  "sources": ["list", "of", "sources", "seen", "in", "forum", "data"]
}

Rules for build_complexity:
- LOW: single API integration, simple document parsing, straightforward automation
- MEDIUM: multi-step workflow, 2-3 integrations, moderate NLP
- HIGH: complex orchestration, custom ML, deep ERP integrations, real-time processing

Respond as a JSON array only. Every field must be non-empty.`,
      },
    ],
  });

  try {
    const raw = msg.content[0].text.replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
  } catch (_) {
    return [];
  }
}

// ─── Validator Agent ──────────────────────────────────────────────────────────

async function validatorAgent(ideas) {
  const msg = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are an adversarial product critic reviewing AI agent product ideas.

Ideas to review:
${JSON.stringify(ideas, null, 2)}

For each idea, add these fields:
- "risk": main failure risk in one specific sentence
- "verdict": "ship" | "pivot" | "kill"
- "adjusted_confidence": your honest 0-100 score (be skeptical — most ideas deserve 60-80, not 90+)

Also: if any of these fields are empty or generic, fill them in with specific content:
- icp, current_workaround, market_signal, build_complexity

Return the full array with all fields added/updated, as JSON only.`,
      },
    ],
  });

  try {
    const raw = msg.content[0].text.replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
  } catch (_) {
    return ideas;
  }
}

// ─── Ticket Formatter ─────────────────────────────────────────────────────────

function formatTickets(ideas, date) {
  const dateStr = date.toISOString().slice(0, 10);
  const shippable = ideas.filter(i => i.verdict !== 'kill' && i.adjusted_confidence >= 80);

  if (shippable.length === 0) {
    return `⚠️ No confirmed problems today. Minimum source threshold not met.\nAction: No new tickets created. Monitor running normally.`;
  }

  const lines = [`📋 ${shippable.length} NEW TICKET(S) CREATED`];

  shippable.forEach((idea, idx) => {
    const ticketId = `AGT-${dateStr}-${String(idx + 1).padStart(3, '0')}`;
    const priorityIcon = idea.priority === 'HIGH' ? '🔴' : idea.priority === 'MEDIUM' ? '🟡' : '🟢';
    const complexity = idea.build_complexity || 'MEDIUM';

    lines.push(`
══════════════════════════════
🎫 TICKET: ${ticketId}
──────────────────────────────
Title: ${idea.name}
Agent Type: ${idea.agent_type}
Priority: ${priorityIcon} ${idea.priority}
Build Complexity: ${complexity}
Confidence Score: ${idea.adjusted_confidence}/100

📝 Problem:
${idea.problem}

🎯 ICP: ${idea.icp}
⚠️ Current workaround: ${idea.current_workaround}
📊 Market signal: ${idea.market_signal}
⚡ Risk: ${idea.risk}
✅ Verdict: ${idea.verdict.toUpperCase()}

🔗 Sources: ${(idea.sources || []).join(', ')}
Forum Posts Supporting: ${idea.forum_posts_count || 3}

Status: 🆕 NEW — Awaiting prioritization`);
  });

  lines.push(`\n────────────────────────────────\nAuto-generated by Agent Market Monitor\nOnly problems with independent cross-validation included`);
  return lines.join('\n');
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

async function runPipeline(topic = 'construction finance automation') {
  const now = new Date();
  console.log(`\n[orchestrator] Pipeline start: "${topic}" at ${now.toISOString()}`);

  console.log('[forum-scraper] Scraping Reddit, HN, HN Ask, ProductHunt...');
  const posts = await forumScraperAgent(topic);
  console.log(`[forum-scraper] Found ${posts.length} posts`);

  if (posts.length < 5) {
    return {
      topic,
      posts_analyzed: posts.length,
      ideas: [],
      report: '⚠️ No confirmed problems today. Minimum source threshold not met.\nAction: No new tickets created. Monitor running normally.',
      generated_at: now.toISOString(),
    };
  }

  console.log('[idea-generator] Generating ideas...');
  const ideas = await ideaGeneratorAgent(posts);
  console.log(`[idea-generator] Generated ${ideas.length} ideas`);

  console.log('[validator] Validating and enriching ideas...');
  const validated = await validatorAgent(ideas);
  console.log(`[validator] Done — ${validated.filter(i => i.verdict === 'ship').length} ideas passed`);

  // tag each idea with post count from matching sources
  validated.forEach(idea => {
    const matchingSources = idea.sources || [];
    idea.forum_posts_count = posts.filter(p => matchingSources.includes(p.source)).length;
  });

  const report = formatTickets(validated, now);

  return {
    topic,
    posts_analyzed: posts.length,
    ideas: validated,
    report,
    generated_at: now.toISOString(),
  };
}

// ─── API Routes ───────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.get('/run', async (req, res) => {
  const topic = req.query.topic || 'construction finance automation';
  try {
    const result = await runPipeline(topic);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/run', async (req, res) => {
  const { topic = 'construction finance automation' } = req.body;
  try {
    const result = await runPipeline(topic);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/report', async (req, res) => {
  const topic = req.query.topic || 'construction finance automation';
  try {
    const result = await runPipeline(topic);
    res.type('text').send(`🛠 DEV PIPELINE UPDATE — ${new Date().toISOString().slice(0, 10)}\nAgent Store: New Opportunities Validated\nTimestamp: ${result.generated_at}\n────────────────────────────────\n\n${result.report}`);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`agent-market-site running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET /run?topic=construction+finance`);
  console.log(`  GET /report?topic=construction+finance`);
  console.log(`  GET /health`);
});
