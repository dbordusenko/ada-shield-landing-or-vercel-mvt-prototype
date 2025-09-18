'use client';

import { useUser } from '@clerk/nextjs';
import PricingCard from '@/components/PricingCard';
import Stripe from 'stripe';

const tiers = [
  { name: 'Micro', price: 99, features: ['Basic Scan', 'Reports'] },
  { name: 'Growth', price: 249, features: ['Auto-Fixes', 'Legal Docs'] },
  { name: 'Scale', price: 499, features: ['Integrations', 'Consults'] },
];

export default function Pricing() {
  const { user } = useUser();

  const handleSubscribe = async (tier: string) => {
    // Stripe checkout logic (use Stripe.js or API)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // Create session and redirect
    const session = await stripe.checkout.sessions.create({
      customer_email: user?.emailAddresses[0].emailAddress,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: 'price_id_for_tier', quantity: 1 }], // Replace with real price IDs
      success_url: `${window.location.origin}/dashboard`,
      cancel_url: `${window.location.origin}/pricing`,
    });
    window.location.href = session.url!;
  };

  return (
    <div className="py-20 text-center">
      <h1 className="text-3xl font-bold">Choose Your Plan</h1>
      <div className="grid grid-cols-3 gap-4 mt-8">
        {tiers.map((tier) => (
          <PricingCard key={tier.name} tier={tier} onSubscribe={handleSubscribe} />
        ))}
      </div>
    </div>
  );
}
