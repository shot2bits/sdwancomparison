"use client";

/**
 * Owner-state banner for the public notice page (Harry's QA F17): the page
 * anonymises the buyer by design and shows supplier-facing sign-in CTAs, so
 * a signed-in buyer viewing their own listing reasonably read it as a lost
 * session. This banner renders only when the browser holds the opportunity's
 * buyer token (the same key the Live Opportunity Room uses), states that the
 * anonymous public view is intentional, and links back to the management
 * room. Server markup is untouched; the public page stays identical for
 * everyone else.
 */

import { useEffect, useState } from "react";

export default function OpportunityOwnerBanner({ id }: { id: string }) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    try {
      setIsOwner(Boolean(localStorage.getItem(`opp_btok_${id}`)));
    } catch {
      /* private mode: no banner */
    }
  }, [id]);

  if (!isOwner) return null;

  return (
    <div className="mb-6 rounded-sm border border-emerald-300 bg-emerald-50 p-4">
      <p className="m-0 text-sm text-emerald-900">
        <span className="font-semibold">This is your listing.</span> You are viewing the public notice exactly as
        suppliers and visitors see it: the buyer shows as anonymous by design, and the sign-in prompts on this page
        are for suppliers, not for you.
      </p>
      <p className="m-0 mt-2 text-sm">
        <a href={`/sase/opportunities/${id}/room`} className="font-medium text-emerald-900 underline">
          Open your Live Opportunity Room to manage it
        </a>
      </p>
    </div>
  );
}
