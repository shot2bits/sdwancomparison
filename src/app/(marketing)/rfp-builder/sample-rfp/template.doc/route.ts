import { buildSampleProject } from "@/lib/sample-rfp";
import { buildRfpHtml } from "@/lib/rfp-document";

/**
 * Ungated Word download of the sample RFP as a starting template
 * (18 July 2026, template SEO). Deliberately open: template-seekers are
 * buyers actively writing an RFP this week, and the document itself carries
 * the builder URL. Clearly watermarked as a sample for a fictional buyer;
 * the buyer's own RFP requires the builder (and publishing requires
 * identity), so nothing private leaks by being open here.
 */
export async function GET() {
  const html = buildRfpHtml(buildSampleProject(), {
    watermark:
      "SAMPLE for a fictional buyer. Build your own tailored RFP free at netify.co.uk/sase-sd-wan-rfp-builder/",
  });
  return new Response(html, {
    headers: {
      "content-type": "application/msword",
      "content-disposition": `attachment; filename="netify-sase-sd-wan-rfp-template.doc"`,
      "cache-control": "public, max-age=3600",
    },
  });
}
