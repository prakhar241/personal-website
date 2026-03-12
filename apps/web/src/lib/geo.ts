// ============================================
// Geo-location from request headers
//
// In production (behind Azure Front Door, Cloudflare,
// or nginx with GeoIP), geo-info comes from headers.
// Falls back to a lightweight IP geolocation lookup.
// ============================================

import { NextRequest } from "next/server";

export interface GeoInfo {
  country: string | null;
  region: string | null;
  city: string | null;
  ip: string | null;
}

/**
 * Extract geo-location from request headers.
 * Works with:
 * - Azure Front Door: X-Azure-ClientIP, X-Azure-Geo-*
 * - Cloudflare: CF-IPCountry, CF-Connecting-IP
 * - Vercel: X-Vercel-IP-Country, X-Vercel-IP-City
 * - Nginx GeoIP module: X-Real-IP + custom headers
 * - Generic: X-Forwarded-For
 */
export function getGeoFromRequest(req: NextRequest): GeoInfo {
  const headers = req.headers;

  // Country detection (priority order)
  const country =
    headers.get("cf-ipcountry") || // Cloudflare
    headers.get("x-vercel-ip-country") || // Vercel
    headers.get("x-azure-clientip-country") || // Azure Front Door (custom rule)
    headers.get("x-geo-country") || // Custom proxy header
    null;

  // Region / state
  const region =
    headers.get("x-vercel-ip-country-region") ||
    headers.get("x-geo-region") ||
    headers.get("cf-region") ||
    null;

  // City
  const city =
    headers.get("x-vercel-ip-city") ||
    headers.get("x-geo-city") ||
    headers.get("cf-ipcity") ||
    null;

  // Client IP (for server-side geo lookup if needed)
  const ip =
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-azure-clientip") ||
    getIpFromForwardedFor(headers.get("x-forwarded-for")) ||
    null;

  return { country, region, city, ip };
}

function getIpFromForwardedFor(header: string | null): string | null {
  if (!header) return null;
  // X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2
  // The first one is the original client IP
  const firstIp = header.split(",")[0]?.trim();
  return firstIp || null;
}
