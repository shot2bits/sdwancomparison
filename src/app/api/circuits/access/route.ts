import { z } from "zod";
import { sessionFromRequest } from "@/lib/auth";
import { createCircuitAccess } from "@/lib/circuit-agent";
export async function POST(req: Request) {
  const session = await sessionFromRequest(req);
  const headers = { "Cache-Control": "private, no-store" };
  if (!session) return Response.json({ error: "Sign in required." }, { status: 401, headers });
  const origin = req.headers.get("origin");
  if (
    origin &&
    origin !== new URL(req.url).origin &&
    ![
      "https://netify.co.uk",
      "https://www.netify.co.uk",
      "https://app.netify.co.uk",
      "https://sase.netify.co.uk",
    ].includes(origin)
  )
    return Response.json({ error: "Origin not allowed." }, { status: 403, headers });
  try {
    const { id } = z
      .object({ id: z.string().uuid() })
      .strict()
      .parse(await req.json());
    return Response.json(await createCircuitAccess(id, session), { headers });
  } catch {
    return Response.json(
      { error: "Access could not be created. Only the request owner can create a token." },
      { status: 403, headers },
    );
  }
}
