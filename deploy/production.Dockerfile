FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

FROM node:20-alpine AS production

RUN addgroup -S zavorth && adduser -S zavorth -G zavorth

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/docs ./docs
COPY --from=builder /usr/src/app/config ./config

RUN mkdir -p /usr/src/app/data /usr/src/app/tmp /usr/src/app/memory \
 && chown -R zavorth:zavorth /usr/src/app

ENV NODE_ENV=production \
    ZAVORTH_WEB_HOST=0.0.0.0 \
    ZAVORTH_WEB_PORT=33333 \
    ZAVORTH_PROFILE=ops \
    ZAVORTH_CAPABILITY_POLICY=ask-on-demand \
    ZAVORTH_SELFMOD_POLICY=owner_trusted \
    ZAVORTH_ALLOW_STARTUP_INSTALL=false

VOLUME ["/usr/src/app/data", "/usr/src/app/tmp", "/usr/src/app/memory"]

USER zavorth

EXPOSE 33333

CMD ["node", "dist/host.js"]
