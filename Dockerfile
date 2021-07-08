FROM node:alpine AS BUILD
RUN apk update && \
  apk add build-base python3
WORKDIR /opt/minecraft-proxy
COPY package-lock.json package.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build
RUN rm -rf node_modules && npm ci --prod

FROM node:alpine AS RUNTIME
WORKDIR /opt/minecraft-proxy
COPY package-lock.json package.json ./
COPY --from=BUILD /opt/minecraft-proxy/node_modules ./node_modules
COPY --from=BUILD /opt/minecraft-proxy/dist ./dist
COPY bin ./bin
CMD node bin/mcproxy
EXPOSE 25565
