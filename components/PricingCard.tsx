import { Card } from './ui/card';
import { Button } from './ui/button';

interface PricingCardProps {
  tier: { name: string; price: number; features: string[]; trialDays: number };
  onSubscribe: () => void;
}

export default function PricingCard({ tier, onSubscribe }: PricingCardProps) {
  return (
    <Card className="p-6 shadow-lg">
      <h3 className="text-2xl font-bold">{tier.name}</h3>
      <p className="text-xl mt-2">${tier.price}/mo</p>
      {tier.trialDays > 0 && <p className="text-sm text-gray-600 mt-1">{tier.trialDays}-day free trial</p>}
      <ul className="mt-4 list-disc list-inside">
        {tier.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <Button onClick={onSubscribe} className="mt-6 w-full bg-secondary hover:bg-green-700" aria-label={`Subscribe to ${tier.name} plan`}>
        Subscribe
      </Button>
    </Card>
  );
}