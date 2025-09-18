# ADA Shield

AI-powered ADA Compliance Scanner for SMB websites. Avoid lawsuits, ensure accessibility, and generate revenue with a modern SaaS app.

## Improvements Implemented
- Real ADA scans with Puppeteer + axe-core
- Supabase for auth + DB with audit logs
- Vercel AI SDK for custom request handling
- Stripe Embedded Checkout + free trials
- Shadcn UI Tabs, Accordion, Progress
- Next.js middleware + security headers
- Vercel Cron for scheduled scans
- Zapier for marketing automation

## Setup
1. Clone: `git clone https://github.com/yourusername/ada-shield.git`
2. Install: `npm install`
3. Shadcn UI: `npx shadcn-ui@latest init`, then `npx shadcn-ui@latest add tabs accordion progress`
4. Env: Copy `.env.example` to `.env.local`, fill with Clerk, Supabase, Stripe keys
5. Supabase: Create tables (users, scans, audit_logs, leads)
6. Run: `npm run dev`
7. Deploy: Push to GitHub, import to Vercel

## Dependencies
- Next.js 15
- Tailwind CSS + Shadcn UI
- Clerk (auth)
- Supabase (DB)
- Stripe (payments)
- Puppeteer + axe-core (scans)
- Vercel AI SDK (AI agent)

## Deployment
- Vercel: Auto-detects Next.js, set env vars
- Stripe: Add Price IDs in `/api/checkout/route.ts`, set webhook
- Supabase: Initialize tables via dashboard
- Cron: Scheduled scans via `vercel.json`