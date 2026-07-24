import type { Metadata } from "next";
import AuthWelcome from "@/components/AuthWelcome";

export const metadata: Metadata = { title: "Welcome to Netify", robots: { index: false, follow: false } };

/**
 * The welcome step after a first LinkedIn sign-up (24 July 2026): one
 * question, skippable, never a wall. LinkedIn verifies the person and
 * gives us their name; this page asks the one thing it cannot tell us,
 * which company they are buying for. Answers stay internal to the
 * Netify team; suppliers only ever see the anonymous position.
 */
export default function WelcomePage() {
  return (
    <div className="max-w-md mx-auto px-6 py-24">
      <AuthWelcome />
    </div>
  );
}
