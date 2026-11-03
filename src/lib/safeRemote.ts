import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { BlockList } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const blocked = new BlockList();
const blockedV6 = new BlockList();
for (const [address, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['192.0.0.0',24],['198.18.0.0',15],['224.0.0.0',4],['240.0.0.0',4]] as const) blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [['::',128],['::1',128],['fc00::',7],['fe80::',10],['ff00::',8],['::ffff:0:0',96]] as const) blockedV6.addSubnet(address, prefix, 'ipv6');
const isBlocked = (address: string, family: number) => family === 6 ? blockedV6.check(address, 'ipv6') : blocked.check(address, 'ipv4');
export async function validatePublicUrl(input: string) {
  const url = new URL(input);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port))) throw new Error('Use a public HTTP or HTTPS URL.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some(({ address, family }) => isBlocked(address, family))) throw new Error('Private network addresses cannot be imported.');
  return url;
}
export async function safeRemoteFetch(input: string, options: RequestInit = {}): Promise<Response> {
  let url = input;
  for (let redirects = 0; redirects < 6; redirects++) {
    const parsed = await validatePublicUrl(url);
    const host = parsed.hostname.replace(/^\[|\]$/g, '');
    // Pin a validated address at connection time to prevent DNS rebinding.
    const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
    if (addresses.some(({ address, family }) => isBlocked(address, family))) throw new Error('Private network addresses cannot be imported.');
    const address = addresses[0];
    if (!address) throw new Error('The remote host could not be resolved.');
    const response = await new Promise<Response>((resolve, reject) => {
      const request = (parsed.protocol === 'https:' ? httpsRequest : httpRequest)(parsed, {
        method: 'GET', headers: Object.fromEntries(new Headers(options.headers)),
        signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
        family: address.family,
        lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      }, incoming => {
        const chunks: Buffer[] = []; let size = 0;
        incoming.on('data', chunk => {
          size += chunk.length;
          if (size > 5 * 1024 * 1024) { request.destroy(new Error('The remote page is too large to import.')); return; }
          chunks.push(Buffer.from(chunk));
        });
        incoming.on('error', reject);
        incoming.on('end', () => {
          const headers = new Headers();
          for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
          const status = incoming.statusCode || 502;
          const result = new Response([204,205,304].includes(status) ? null : Buffer.concat(chunks), { status, headers });
          Object.defineProperty(result, 'url', { value: url });
          resolve(result);
        });
      });
      request.on('error', reject); request.end();
    });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('The remote site returned an invalid redirect.');
      url = new URL(location, url).href;
      continue;
    }
    return response;
  }
  throw new Error('The remote site redirected too many times.');
}
