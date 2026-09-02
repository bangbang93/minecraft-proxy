import {IPv4, IPv4CidrRange, IPv6, IPv6CidrRange} from 'ip-num'

const IPV4_MAPPED = /^::ffff:\d+\.\d+\.\d+\.\d+$/

/**
 * A CIDR block that can test whether an IP address (as a string) falls inside it.
 *
 * Replaces the unmaintained `ip-cidr` (which pinned a vulnerable `ip-address`).
 * A bare IP (without a `/prefix`) is treated as a single-address block (/32 or /128).
 */
export class Cidr {
  private readonly range: IPv4CidrRange | IPv6CidrRange

  constructor(cidr: string) {
    let normalized = cidr
    if (!normalized.includes('/')) {
      normalized += normalized.includes(':') ? '/128' : '/32'
    }
    this.range = normalized.includes(':')
      ? IPv6CidrRange.fromCidr(normalized)
      : IPv4CidrRange.fromCidr(normalized)
  }

  public contains(ip: string): boolean {
    if (!ip) return false
    if (this.range instanceof IPv4CidrRange) {
      const v4 = IPV4_MAPPED.test(ip) ? ip.slice('::ffff:'.length) : ip
      if (v4.includes(':')) return false
      try {
        return this.range.contains(new IPv4(v4))
      } catch {
        return false
      }
    }
    try {
      return this.range.contains(new IPv6(ip))
    } catch {
      return false
    }
  }
}
