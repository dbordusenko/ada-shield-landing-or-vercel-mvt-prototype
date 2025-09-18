import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

export async function POST(request: Request) {
  const { email, url } = await request.json();
  await supabase.from('leads').insert([{ email, url, source: 'zapier' }]);
  return NextResponse.json({ success: true });
}