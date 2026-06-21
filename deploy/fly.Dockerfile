FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

FROM node:22-alpine AS production

RUN apk add --no-cache dumb-init curl

RUN addgroup -g 1001 -S zavorth && \
    adduser -S zavorth -u 1001 -G zavorth

WORKDIR /app

COPY --from=build --chown=zavorth:zavorth /app/dist ./dist
COPY --from=build --chown=zavorth:zavorth /app/package.json ./
COPY --from=build --chown=zavorth:zavorth /app/package-lock.json ./
COPY --from=build --chown=zavorth:zavorth /app/node_modules ./node_modules

USER zavorth

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/host.js"]
