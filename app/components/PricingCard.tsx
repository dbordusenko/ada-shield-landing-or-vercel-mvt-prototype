import { Card } from './ui/card';
import { Button } from './ui/button';

interface PricingCardProps {
  tier: { name: string; price: number; features: string[] };
  onSubscribe: (tier: string) => void;
}

export default function PricingCard({ tier, onSubscribe }: PricingCardProps) {
  return (
    <Card className="p-6">
      <h3 className="text-2xl font-bold">{tier.name}</h3>
      <p className="text-xl mt-2">${tier.price}/mo</p>
      <ul className="mt-4">
        {tier.features.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <Button onClick={() => onSubscribe(tier.name)} className="mt-6 w-full">Subscribe</Button>
    </Card>
  );
}
