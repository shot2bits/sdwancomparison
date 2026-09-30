import { z } from "zod";
export const ResponsePanelRowSchema = z
  .object({
    slug: z.string().trim().min(1).max(120),
    contact_name: z.string().trim().min(1).max(160),
    contact_role: z.string().trim().min(1).max(160),
    contact_email_domain: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/),
    agreed_response_working_days: z.number().int().positive().max(365),
    introduction_terms_acknowledged_at: z.iso.datetime(),
    acknowledged_by: z.string().trim().min(1).max(160),
    source: z.string().trim().min(1).max(1000),
  })
  .strict();
export type ResponsePanelRow = z.infer<typeof ResponsePanelRowSchema>;
export type PublicPanelMember = Pick<
  ResponsePanelRow,
  | "slug"
  | "contact_name"
  | "contact_role"
  | "contact_email_domain"
  | "agreed_response_working_days"
  | "introduction_terms_acknowledged_at"
>;
export function responsePanelMember(row: unknown): row is ResponsePanelRow {
  const parsed = ResponsePanelRowSchema.safeParse(row);
  return (
    parsed.success &&
    Date.parse(parsed.data.introduction_terms_acknowledged_at) <= Date.now()
  );
}
export function publicPanelMember(row: ResponsePanelRow): PublicPanelMember {
  const {
    slug,
    contact_name,
    contact_role,
    contact_email_domain,
    agreed_response_working_days,
    introduction_terms_acknowledged_at,
  } = row;
  return {
    slug,
    contact_name,
    contact_role,
    contact_email_domain,
    agreed_response_working_days,
    introduction_terms_acknowledged_at,
  };
}
export function annotateResponsePanel<T extends { slug: string }>(
  providers: T[],
  rows: ResponsePanelRow[],
) {
  return providers.map((p) => {
    const row = rows.find((r) => r.slug === p.slug && responsePanelMember(r));
    return { ...p, response_panel: row ? publicPanelMember(row) : null };
  });
}
