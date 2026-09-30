export class MarketplaceProjectConflict extends Error { status = 409 as const; }
export class MarketplaceProjectUnauthorised extends Error { status = 404 as const; }
