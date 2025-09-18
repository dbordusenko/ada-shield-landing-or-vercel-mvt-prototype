import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <header className="bg-primary text-white w-full py-20 text-center">
        <h1 className="text-4xl font-bold">Avoid $55k ADA Fines</h1>
        <p className="text-xl mt-4">AI Scanner + Fixes + Legal Docs for SMBs</p>
        <Link href="/pricing">
          <Button className="mt-6 bg-secondary hover:bg-green-700">Get Started</Button>
        </Link>
      </header>
      <section className="py-20">
        <h2 className="text-3xl font-semibold">Real Pains We Solve</h2>
        <ul className="list-disc mt-4">
          <li>Frivolous lawsuits from legal bots</li>
          <li>Compliance overwhelm</li>
          <li>High fines and reputation damage</li>
        </ul>
      </section>
    </div>
  );
}
