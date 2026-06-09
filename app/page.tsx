import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <header className="bg-primary text-white w-full py-20 text-center">
        <h1 className="text-4xl font-bold">Avoid $55k ADA Fines</h1>
        <p className="text-xl mt-4">AI Scanner + Fixes + Legal Docs for SMBs</p>
        <Link href="/pricing">
          <Button className="mt-6 bg-secondary hover:bg-green-700" aria-label="Get started with ADA Shield">Get Started</Button>
        </Link>
      </header>
      <section className="py-20 max-w-4xl mx-auto">
        <h2 className="text-3xl font-semibold">Real Pains We Solve</h2>
        <Accordion type="single" collapsible className="mt-4">
          <AccordionItem value="item-1">
            <AccordionTrigger>Lawsuit Risks</AccordionTrigger>
            <AccordionContent>Frivolous lawsuits from legal bots demanding $50k settlements.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Compliance Overwhelm</AccordionTrigger>
            <AccordionContent>Complex WCAG rules overwhelming small teams.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>High Costs</AccordionTrigger>
            <AccordionContent>$55k+ fines plus reputation damage.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
      <section className="py-20 bg-gray-100 w-full">
        <h2 className="text-3xl font-semibold">Get Your Free Risk Scan</h2>
        <form className="max-w-md mx-auto mt-6">
          <input
            type="email"
            placeholder="Enter your email"
            className="w-full p-3 mb-4 border rounded"
            required
            aria-label="Email address"
          />
          <input
            type="url"
            placeholder="Your website URL"
            className="w-full p-3 mb-4 border rounded"
            required
            aria-label="Website URL"
          />
          <Button type="submit" className="w-full bg-secondary hover:bg-green-700" aria-label="Run free ADA scan">
            Scan Now
          </Button>
        </form>
      </section>
    </div>
  );
}