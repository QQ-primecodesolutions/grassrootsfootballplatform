import { publicEnv } from "@/lib/env";

// Placeholder until Milestone 3 (organisation list / redirect).
export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold">{publicEnv.NEXT_PUBLIC_APP_NAME}</h1>
      <p className="mt-2 text-muted">Public pages arrive in Milestone 3.</p>
    </main>
  );
}
