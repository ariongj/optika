import http from 'node:http';
import https from 'node:https';

// Node's browser-style fetch rejects the registered local Sieve port 4190.
// A normal HTTP client supports the project's existing port without changing it.
export function seoFetch(url, { method = 'GET', signal } = {}) {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const request = (target.protocol === 'https:' ? https : http).request(target, { method, signal, timeout: 30000 }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(response.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        const body = Buffer.concat(chunks);
        resolve({
          status: response.statusCode,
          headers,
          text: async () => body.toString('utf8'),
          arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        });
      });
    });
    request.on('timeout', () => request.destroy(new Error('HTTP request timed out')));
    request.on('error', reject); request.end();
  });
}
