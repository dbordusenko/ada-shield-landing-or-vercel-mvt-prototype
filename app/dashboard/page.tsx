import { SignedIn, RedirectToSignIn } from '@clerk/nextjs';
import ScanForm from '@/components/ScanForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Dashboard() {
  return (
    <SignedIn>
      <div className="py-20 text-center max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold">Your Compliance Dashboard</h1>
        <Tabs defaultValue="scans" className="mt-6">
          <TabsList>
            <TabsTrigger value="scans">Scans</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
          <TabsContent value="scans">
            <ScanForm />
            <div className="mt-8">
              <h2 className="text-2xl">Recent Scans</h2>
              <p>No scans yet. Run a scan to see results.</p>
            </div>
          </TabsContent>
          <TabsContent value="reports">
            <h2 className="text-2xl">Compliance Reports</h2>
            <p>Generate legal reports here (coming soon).</p>
          </TabsContent>
        </Tabs>
      </div>
    </SignedIn>
  );
}