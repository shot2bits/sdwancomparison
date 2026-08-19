import localFont from "next/font/local";

/**
 * 19 Aug 2026, aesthetic-only restyle (Robert's "UI mockups request"
 * handoff bundle, design_handoff_sase_sourcing_builder): the reference
 * design calls for Space Grotesk (headings/card titles/nav labels/brand
 * wordmark, weights 500/600/700) and JetBrains Mono (IDs, stat numbers,
 * counts, percentages, any tabular/data value, weights 400/500/600) --
 * see the handoff README's "2. Typography" section.
 *
 * This is a deliberate, knowing reversal of the 19 Aug 2026 (earlier the
 * same day) decision to drop all custom webfonts sitewide in favour of
 * the platform's own system font -- but that earlier decision concerned
 * netify.co.uk's MARKETING pages, and Robert's follow-up request here is
 * scoped explicitly to "the SASE sourcing builder" (the .procurement-2030
 * living-document workspace surface), not the whole site. So: sitewide
 * marketing typography (layout.tsx, globals.css's un-prefixed --font-*
 * tokens) stays system-font, untouched. Only the workspace surface's own
 * --nf-font-serif/--nf-font-mono tokens pick these up; --nf-font-sans
 * stays system-ui too, per the handoff doc's own instruction ("Body text,
 * buttons, descriptions: system UI font stack -- no change needed").
 *
 * Self-hosted (next/font/local) rather than next/font/google for the same
 * reason Inter was self-hosted earlier in this project: next/font/google
 * fetches font bytes from fonts.googleapis.com at BUILD time, which fails
 * outright in this project's network-restricted build/dev environment.
 * The static weight files below are the exact same bytes Google Fonts
 * serves for these two families (sourced via the @fontsource npm
 * packages, latin subset, then vendored as plain files here -- no
 * @fontsource runtime dependency), so the *rendered* typeface is
 * unchanged; only how the bytes reach the browser differs.
 */
export const spaceGrotesk = localFont({
  src: [
    { path: "../../fonts/space-grotesk-500.woff2", weight: "500", style: "normal" },
    { path: "../../fonts/space-grotesk-600.woff2", weight: "600", style: "normal" },
    { path: "../../fonts/space-grotesk-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const jetbrainsMono = localFont({
  src: [
    { path: "../../fonts/jetbrains-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/jetbrains-mono-500.woff2", weight: "500", style: "normal" },
    { path: "../../fonts/jetbrains-mono-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

/** Applied to the workspace surface's outermost element (WorkspaceLayout,
 *  and any (marketing)-group page that reuses .procurement-2030 panels --
 *  e.g. the opportunities board / supplier-facing preview) so the two CSS
 *  variables above are in scope wherever globals.css's .procurement-2030
 *  block (--nf-font-serif/--nf-font-mono) reads them. */
export const workspaceFontVars = `${spaceGrotesk.variable} ${jetbrainsMono.variable}`;
