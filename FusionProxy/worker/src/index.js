import { createBareServer } from "@tomphttp/bare-server-node";

export default {
    async fetch(request, env, ctx) {
        const bare = createBareServer("/bare/");
        if (bare.shouldRoute(request)) {
            return await bare.routeRequest(request);
        }
        return new Response("Not found", { status: 404 });
    }
}
