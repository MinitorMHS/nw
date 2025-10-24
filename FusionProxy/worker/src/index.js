class BareError extends Error {
	status;
	body;
	constructor(status, body) {
		super(body.message || body.code);
		this.status = status;
		this.body = body;
	}
}

function json(status, json) {
    const send = Buffer.from(JSON.stringify(json, null, '\t'));
    return new Response(send, {
        status,
        headers: {
            'content-type': 'application/json',
            'content-length': send.byteLength.toString(),
        },
    });
}

class Server {
    directory;
    routes = new Map();
    socketRoutes = new Map();
    versions = [];
    closed = false;
    options;
    /**
     * @internal
     */
    constructor(directory, options) {
        this.directory = directory;
        this.options = options;
    }

    /**
     * Remove all timers and listeners
     */
    close() {
        this.closed = true;
    }
    shouldRoute(request) {
        return (!this.closed &&
            request.url !== undefined &&
            new URL(request.url).pathname.startsWith(this.directory));
    }
    get instanceInfo() {
        return {
            versions: this.versions,
            language: 'Cloudflare',
            maintainer: this.options.maintainer,
            project: {
                name: 'fusion-proxy',
                version: '0.1.0',
            }
        };
    }

    async routeRequest(req) {
        const request = new Request(req);
        const service = new URL(request.url).pathname.slice(this.directory.length - 1);
        let response;
        try {
            if (request.method === 'OPTIONS') {
                response = new Response(undefined, { status: 200 });
            }
            else if (service === '/') {
                response = json(200, this.instanceInfo);
            }
            else if (this.routes.has(service)) {
                const call = this.routes.get(service);
                response = await call(request);
            }
            else {
                throw new BareError(404, {
                    code: 'NOT_FOUND',
                    message: 'Not found',
                });
            }
        }
        catch (error) {
            if (this.options.logErrors)
                console.error(error);
            if (error instanceof BareError) {
                response = json(error.status, error.body);
            }
            else {
                response = json(500, {
                    code: 'UNKNOWN',
                    message: 'Unknown error',
                });
            }
        }
        response.headers.set('x-robots-tag', 'noindex');
        response.headers.set('access-control-allow-headers', '*');
        response.headers.set('access-control-allow-origin', '*');
        response.headers.set('access-control-allow-methods', '*');
        response.headers.set('access-control-expose-headers', '*');
        // don't fetch preflight on every request...
        // instead, fetch preflight every 10 minutes
        response.headers.set('access-control-max-age', '7200');
        return response;
    }
}

export default {
    async fetch(request, env, ctx) {
        const server = new Server('/bare/', {
            logErrors: true,
        });

        // This is a simplified version of the Infrared routing logic.
        // It's not fully featured, but it's enough to get the server running.
        server.routes.set('/v1/', async (req) => {
            const headers = new Headers(req.headers);
            const url = new URL(req.url);
            const remoteUrl = new URL(url.searchParams.get('url'));

            const response = await fetch(remoteUrl.toString(), {
                headers,
                method: req.method,
                body: req.body,
            });

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            });
        });

        if (server.shouldRoute(request)) {
            return await server.routeRequest(request);
        }

        return env.ASSETS.fetch(request);
    }
}
