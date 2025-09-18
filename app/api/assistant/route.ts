import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

export async function POST(request: Request) {
  const { query, userId } = await request.json();
  // Mock AI response (integrate Vercel AI SDK or OpenAI for real queries)
  let response = 'Processing custom request...';
  if (query.includes('GDPR')) {
    response = 'Custom GDPR compliance scan added to queue.';
  }
  await supabase.from('audit_logs').insert([{ user_id: userId, action: 'custom_request', details: query }]);
  return NextResponse.json({ response });
}