import { permanentRedirect } from "next/navigation";

/**
 * /security-sourcing/ redirects into the Live Sourcing Workspace (W0
 * slice 3, Robert's decision of 21 July 2026, spec v1.3 section 3: one
 * door for security, SASE and SD-WAN, completing rather than replacing
 * the security advisor journey). 308, permanent, with the security scope
 * seeded so arrivals keep their intent; the advisor component itself
 * lives on inside the project re-scope surface.
 */
export default function Page() {
  permanentRedirect("/workspace/?scope=security");
}
