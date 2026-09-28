import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { handleLead } from './functions/api/lead.js';

const host = process.env.HOST || '127.0.0.1';
const port = Number.parseInt(process.env.PORT || '3000', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const sendResponse = async (response, outgoing) => {
  outgoing.statusCode = response.status;
  response.headers.forEach((value, name) => outgoing.setHeader(name, value));
  const body = response.body ? Buffer.from(await response.arrayBuffer()) : null;
  outgoing.end(body);
};

const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url || '/', `http://${incoming.headers.host || 'localhost'}`);

    if (url.pathname === '/healthz') {
      outgoing.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      outgoing.end('ok');
      return;
    }

    if (url.pathname !== '/api/lead') {
      outgoing.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      outgoing.end('{"error":"not found"}');
      return;
    }

    const options = { method: incoming.method, headers: incoming.headers };
    if (!['GET', 'HEAD'].includes(incoming.method || '')) {
      options.body = Readable.toWeb(incoming);
      options.duplex = 'half';
    }
    const request = new Request(url, options);
    const response = await handleLead(request, process.env);
    await sendResponse(response, outgoing);
  } catch {
    outgoing.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    outgoing.end('{"error":"internal error"}');
  }
});

server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.listen(port, host, () => console.log(`SelfCheck API listening on ${host}:${port}`));

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
