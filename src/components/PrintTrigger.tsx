"use client";

import { useEffect } from "react";

/** Opens the print dialog once the print view has rendered. */
export default function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <p className="text-xs text-gray-500 mb-6 print:hidden">
      Use your browser print dialog to save this shortlist as a PDF. If the
      dialog did not open automatically, press Ctrl+P or Cmd+P.
    </p>
  );
}
