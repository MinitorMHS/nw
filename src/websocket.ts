import { z } from 'zod';

// Zod schema for the expected structure of the 'Sec-WebSocket-Protocol' header data
const WsProtocolDataSchema = z.object({
  remote: z.object({
    protocol: z.union([z.literal('ws:'), z.literal('wss:')]),
    hostname: z.string(),
    port: z.string(),
    path: z.string(),
  }),
  headers: z.record(z.string()),
});

export class WebSocketProxy {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected "Upgrade: websocket"', { status: 426 });
    }

    // The client sends connection details encoded in the protocol header
    const protocolDataHeader = request.headers.get('Sec-WebSocket-Protocol');
    if (!protocolDataHeader) {
      return new Response('Missing "Sec-WebSocket-Protocol" header with connection data', { status: 400 });
    }

    let protocolData;
    try {
      // The data is typically base64-encoded JSON sent by the client
      const decodedData = atob(protocolDataHeader);
      const jsonData = JSON.parse(decodedData);
      protocolData = WsProtocolDataSchema.parse(jsonData);
    } catch (e) {
      return new Response(`Invalid "Sec-WebSocket-Protocol" header data: ${e instanceof Error ? e.message : 'Unknown error'}`, { status: 400 });
    }

    const { remote, headers: forwardHeaders } = protocolData;
    const remoteUrl = `${remote.protocol}//${remote.hostname}:${remote.port}${remote.path}`;

    // Create a new WebSocket pair to proxy the connection
    const { 0: clientSocket, 1: remoteSocket } = new WebSocketPair();

    try {
      // Establish the outbound WebSocket connection to the remote server
      const response = await fetch(remoteUrl, {
        headers: {
          ...forwardHeaders,
          'Upgrade': 'websocket',
        },
      });

      const serverSocket = response.webSocket;
      if (!serverSocket) {
        return new Response('Upstream server did not respond with a WebSocket', { status: 502 });
      }

      // --- Start Proxying ---

      // When the client sends a message, forward it to the remote server
      remoteSocket.addEventListener('message', event => {
        serverSocket.send(event.data);
      });

      // When the remote server sends a message, forward it to the client
      serverSocket.addEventListener('message', event => {
        remoteSocket.send(event.data);
      });

      const closeHandler = () => {
        serverSocket.close(1000, "Client disconnected");
        remoteSocket.close(1000, "Client disconnected");
      };

      remoteSocket.addEventListener('close', closeHandler);
      remoteSocket.addEventListener('error', closeHandler);
      serverSocket.addEventListener('close', closeHandler);
      serverSocket.addEventListener('error', closeHandler);

      // Accept the client's WebSocket connection
      remoteSocket.accept();
      // And also accept the server's
      serverSocket.accept();

      return new Response(null, {
        status: 101,
        webSocket: clientSocket,
      });

    } catch (e) {
      return new Response(`Failed to connect to remote WebSocket: ${e instanceof Error ? e.message : 'Unknown error'}`, { status: 502 });
    }
  }
}
