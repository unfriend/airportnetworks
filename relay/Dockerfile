# The relay for shared rooms, serving the app as well (one https:// address for every headset).
# Build from the repository root (Coolify: Dockerfile location /relay/Dockerfile, port 8787):
#   docker build -f relay/Dockerfile -t networks-relay .
#   docker run -p 8787:8787 networks-relay
# On a public server Coolify adds --proxy 1 --public: the environment variable RELAY_ARGS="--proxy 1 --public" (or the
# same at the end of its start command), and the shared password as the secret variable COLLAB_TOKEN; see
# relay/README.md, "Public hosting on Coolify".
FROM node:22-alpine
WORKDIR /app
# the app and the relay; .dockerignore leaves out the tools, their data and the git history
COPY . .
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
# No --proxy here: how many proxies stand in front is the deployment's to say (Coolify's start command adds --proxy 1,
# or --proxy 2 with a CDN such as Cloudflare in front; see relay/README.md). Run directly (docker run -p), clients
# could write any address into X-Forwarded-For, so the header is ignored unless the start command asks for it.
# No --public either: run on a laptop at an event, the relay behaves as it always has. The health check above works with
# --public (it sends no Origin, which only sockets need there) and with a password (/api/health is open, as in
# asdf10k-collab-backend).
CMD ["node", "relay/server.mjs", "--port", "8787", "--static", "."]
