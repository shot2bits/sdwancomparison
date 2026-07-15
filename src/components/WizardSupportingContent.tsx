"use client";

/**
 * Wraps the wizard page's server-rendered supporting sections (the HowTo
 * explainer and the For AI agents block). They exist for crawlers and
 * first-glance orientation, but once a person starts answering the wizard
 * they read as the flow repeating itself (Harry's retest, 15 July 2026),
 * so they hide on the wizard's describe-started event. Server-rendered
 * output is unchanged: crawlers and agents always see the content.
 */

import { useEffect, useState } from "react";

export default function WizardSupportingContent({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const hide = () => setHidden(true);
    window.addEventListener("netify:describe-started", hide);
    return () => window.removeEventListener("netify:describe-started", hide);
  }, []);
  if (hidden) return null;
  return <>{children}</>;
}
