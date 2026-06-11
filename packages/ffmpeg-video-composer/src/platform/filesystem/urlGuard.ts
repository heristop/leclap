import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

// SSRF guard for server-side (Node) media fetches.
//
// A template descriptor can supply an arbitrary `videoUrl` / `music.url` / background
// URL that the engine fetches and feeds to ffmpeg. Without validation that lets a
// template reach internal-only services (cloud metadata at 169.254.169.254, a local
// Elasticsearch on localhost:9200, RFC1918 hosts, ...). This module is default-deny:
// only http(s) to a public destination is allowed.
//
// Residual gaps (accepted for this fix, do not over-engineer):
//   - TOCTOU: we resolve the hostname, validate the resolved IP(s), then hand the URL
//     to axios which resolves again. A DNS-rebinding attacker could return a public IP
//     to us and a private IP to axios. Pinning the resolved IP into the request is
//     awkward with axios; the literal-IP + resolved-IP checks below close the common
//     cases and the race window is small.

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

// Hostnames that must never be fetched regardless of resolution.
const BLOCKED_HOSTNAMES = new Set(['localhost']);

const ipToOctets = (ip: string): number[] => ip.split('.').map((part) => Number.parseInt(part, 10));

const isPrivateIpv4 = (ip: string): boolean => {
  const [a, b] = ipToOctets(ip);

  // 127.0.0.0/8 loopback
  if (a === 127) {
    return true;
  }
  // 10.0.0.0/8
  if (a === 10) {
    return true;
  }
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  // 192.168.0.0/16
  if (a === 192 && b === 168) {
    return true;
  }
  // 169.254.0.0/16 link-local (includes 169.254.169.254 cloud metadata)
  if (a === 169 && b === 254) {
    return true;
  }
  // 0.0.0.0/8 "this network"
  if (a === 0) {
    return true;
  }
  // 100.64.0.0/10 CGNAT
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }

  return false;
};

const isPrivateIpv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();

  // ::1 loopback (and the unspecified ::)
  if (normalized === '::1' || normalized === '::') {
    return true;
  }
  // IPv4-mapped (::ffff:127.0.0.1 etc.) — re-check the embedded IPv4.
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);

  if (mapped) {
    return isPrivateIpv4(mapped[1]);
  }
  // fc00::/7 unique-local (fc.. / fd..)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }
  // fe80::/10 link-local
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }

  return false;
};

const isPrivateIp = (ip: string): boolean => {
  const family = isIP(ip);

  if (family === 4) {
    return isPrivateIpv4(ip);
  }

  if (family === 6) {
    return isPrivateIpv6(ip);
  }

  // Not a recognizable IP literal — caller decides (it's a hostname to resolve).
  return false;
};

// Validate a remote URL before it is fetched server-side. Throws a clear Error when
// the URL is unsafe; resolves when the fetch may proceed.
export const assertSafeRemoteUrl = async (rawUrl: string): Promise<void> => {
  const parsed = new URL(rawUrl);

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new Error(`Refusing to fetch a non-http(s) URL: ${parsed.protocol}//`);
  }

  // URL wraps IPv6 literals in brackets; strip them for the IP checks.
  const host = parsed.hostname.replace(/^\[|\]$/g, '');

  if (BLOCKED_HOSTNAMES.has(host.toLowerCase())) {
    throw new Error(`Refusing to fetch a blocked host: ${host}`);
  }

  // Literal IP destination — reject directly if it sits in a private/reserved range.
  if (isIP(host) !== 0) {
    if (isPrivateIp(host)) {
      throw new Error(`Refusing to fetch a private/reserved address: ${host}`);
    }

    return;
  }

  // Hostname — resolve and re-check every resolved address to catch a name that
  // points (or rebinds) to an internal IP.
  const resolved = await lookup(host, { all: true });

  if (resolved.length === 0) {
    throw new Error(`Refusing to fetch a host that does not resolve: ${host}`);
  }

  const privateHit = resolved.find((entry) => isPrivateIp(entry.address));

  if (privateHit) {
    throw new Error(
      `Refusing to fetch a host resolving to a private/reserved address: ${host} -> ${privateHit.address}`
    );
  }
};
