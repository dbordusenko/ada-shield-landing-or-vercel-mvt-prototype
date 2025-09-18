import { SignedIn, RedirectToSignIn } from '@clerk/nextjs';
import ScanForm from '@/components/ScanForm';

export default function Dashboard() {
  return (
    <SignedIn>
      <div className="py-20 text-center">
        <h1 className="text-3xl font-bold">Your Dashboard</h1>
        <ScanForm />
        {/* Display scans, reports */}
      </div>
    </SignedIn>
    <RedirectToSignIn />
  );
}
