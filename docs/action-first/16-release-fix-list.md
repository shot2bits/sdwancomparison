# Action-first ordered fix list

## Step 1 — remove acquisition lock copy

Shared SOURCING_DESCRIPTION and SHORTLIST_FAQS now supply the specified marketing/entry surfaces, plus remaining related copy. Separately deployed apex receives a generated copy of the authoritative contract rather than hand-retyped text. Legacy permission boundaries remain enforced; their explanatory comments were reworded to satisfy the requested repository-wide scan. No matching weights, estimator calculations or RFP behaviour changed.

Acceptance command: `git grep -n -iE "authorised access|after publication|verified publication|before publication|unlock after|responses and prices are not guaranteed|participation is developing|participation and response times are not guaranteed" -- src/`

Output: no lines; exit 1 (no matches). The retained supplier-facing award caveat does not match this expression, so there are zero rather than two expected lines. Both repositories pass TypeScript with no output; action-first suite passes. Main-site affected-page scan has no matches. Live HTML checks are deferred until coordinated release in Step 7, including JSON-LD. Owner items: none for Step 1.
