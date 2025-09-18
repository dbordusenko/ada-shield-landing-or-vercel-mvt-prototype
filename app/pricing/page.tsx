'use client';

import { useUser } from '@clerk/nextjs';
import PricingCard from '@/components/PricingCard';
import Stripe from 'stripe';

export const revalidate = 3600; // ISR: Revalidate every hour

const tiers = [
  { name: 'Micro', price: 99, features: ['Basic Scan', 'Simple Compliance Report'], trialDays: 0 },
  { name: 'Growth', price: 249, features: ['Auto-Fixes', 'Detailed Legal Docs'], trialDays: 14 },
  { name: 'Scale', price: 499, features: ['CMS Integrations', 'Attorney Consults'], trialDays: 14 },
];

export default function Pricing() {
  const { user } = useUser();

  const handleSubscribe = async (tier: string, trialDays: number) => {
    const stripe = new Stripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, { apiVersion: '2024-10-28.acacia' });
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, email: user?.emailAddresses[0].emailAddress, trialDays }),
    });
    const { url } = await response.json();
    window.location.href = url;
  };

  return (
    <div className="py-20 text-center">
      <h1 className="text-3xl font-bold">Choose Your Plan</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 max-w-6xl mx-auto">
        {tiers.map((tier) => (
          <PricingCard key={tier.name} tier={tier} onSubscribe={() => handleSubscribe(tier.name, tier.trialDays)} />
        ))}
      </div>
    </div>
  );
}