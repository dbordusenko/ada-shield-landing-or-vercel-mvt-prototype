import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

export async function POST(req: Request) {
  const { tier, email, trialDays } = await req.json();
  const priceIds: { [key: string]: string } = {
    Micro: 'price_123', // Replace with real Stripe Price IDs
    Growth: 'price_456',
    Scale: 'price_789',
  };
  try {
    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceIds[tier], quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/pricing`,
      subscription_data: trialDays > 0 ? { trial_period_days: trialDays } : undefined,
      ui_mode: 'embedded',
      return_url: `${process.env.NEXT_PUBLIC_URL}/pricing`,
    });
    await supabase.from('audit_logs').insert([{ user_id: email, action: 'checkout_initiated', details: `Tier: ${tier}` }]);
    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (error) {
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}