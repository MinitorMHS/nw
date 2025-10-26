import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import { handleHttpRequest } from './http';
import { WebSocketProxy } from './websocket';

interface Env {
  WEBSOCKET_PROXY: DurableObjectNamespace;
  BARE_KV: KVNamespace;
}

const app = new Hono<{ Bindings: Env }>();

// --- Static File Serving ---
// Serve the main React app
app.get('/', serveStatic({ path: './dist/index.html' }));
// Serve the built assets (JS, CSS)
app.get('/assets/*', serveStatic({ root: './dist' }));
// Serve the Ultraviolet client files
app.get('/uv/*', serveStatic({ root: './public' }));


// --- Backend API Routes ---
// Bare Server v3 HTTP route
app.post('/v3/', handleHttpRequest);

// Bare Server v3 WebSocket routes
app.get('/v3/ws-new-meta', async (c) => {
  // Create a new unique ID for a Durable Object instance
  const id = c.env.WEBSOCKET_PROXY.newUniqueId();
  // For simplicity, we'll pass connection details in the client request later.
  // In a real scenario, you'd store initial metadata here in KV.
  return new Response(id.toString());
});

app.get('/v3/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected "Upgrade: websocket"', { status: 426 });
  }

  // The client will pass the Durable Object ID in this protocol header
  const durableObjectIdStr = c.req.header('Sec-WebSocket-Protocol');
  if (!durableObjectIdStr) {
    return new Response('Missing "Sec-WebSocket-Protocol" header with Durable Object ID', { status: 400 });
  }

  try {
    const durableObjectId = c.env.WEBSOCKET_PROXY.idFromString(durableObjectIdStr);
    const stub = c.env.WEBSOCKET_PROXY.get(durableObjectId);
    // Forward the request to the Durable Object to handle the WebSocket upgrade
    return stub.fetch(c.req.raw);
  } catch (e) {
    return new Response('Invalid Durable Object ID', { status: 400 });
  }
});

// --- Catch-all for Client-Side Routing ---
// This ensures that any direct navigation to a frontend route (e.g., /app/settings)
// is handled by the React app.
app.get('*', serveStatic({ path: './dist/index.html' }));

export default app;
// Export the Durable Object class
export { WebSocketProxy };
