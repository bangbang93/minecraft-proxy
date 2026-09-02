FROM node:22-bookworm AS BUILD
RUN apt-get update && \
  apt-get install python3 && \
  corepack enable
WORKDIR /opt/minecraft-proxy
COPY package.json pnpm-lock.yaml tsconfig.json ./
RUN pnpm install --frozen-lockfile
COPY src ./src
RUN pnpm run build
RUN pnpm prune --prod

FROM node:22-bookworm AS RUNTIME
WORKDIR /opt/minecraft-proxy
COPY package.json pnpm-lock.yaml ./
COPY --from=BUILD /opt/minecraft-proxy/node_modules ./node_modules
COPY --from=BUILD /opt/minecraft-proxy/dist ./dist
COPY bin ./bin
CMD ["node", "bin/mcproxy"]
EXPOSE 25565
