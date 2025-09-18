import Link from 'next/link';
import { UserButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { Button } from './ui/button';

export default function Header() {
  return (
    <header className="bg-primary text-white p-4 flex justify-between items-center">
      <Link href="/" className="text-2xl font-bold">ADA Shield</Link>
      <nav>
        <Link href="/pricing" className="mr-4">Pricing</Link>
        <SignedIn>
          <Link href="/dashboard" className="mr-4">Dashboard</Link>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <Button asChild>
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </SignedOut>
      </nav>
    </header>
  );
}