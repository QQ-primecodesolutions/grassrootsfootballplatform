import Link from "next/link";
import { privacyNoticeLive } from "@/lib/env";

/** Footer line on every public page: the developer credit, and the privacy notice once it's live. */
export function PlatformCredit({ className = "" }: { className?: string }) {
  return (
    <p className={className}>
      Developed and Maintained By{" "}
      <a href="https://primecodesolutions.co.za" target="_blank" rel="noopener" className="font-semibold underline">
        PrimeCode Solutions
      </a>
      {privacyNoticeLive() ? (
        <>
          {" · "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
        </>
      ) : null}
    </p>
  );
}
