FROM node:24.14.0-bookworm-slim
WORKDIR /demo
COPY package.json worker.mjs ./
COPY node_modules ./node_modules
USER 65534:65534
CMD ["node", "--disallow-code-generation-from-strings", "--frozen-intrinsics", "--max-old-space-size=1152", "worker.mjs"]
