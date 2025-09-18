import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

export async function getUserSubscription(userId: string) {
  const { data } = await supabase.from('users').select('subscription').eq('clerk_id', userId).single();
  return data?.subscription;
}

export async function logAudit(userId: string, action: string, details: string) {
  await supabase.from('audit_logs').insert([{ user_id: userId, action, details }]);
}