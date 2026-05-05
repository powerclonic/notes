# Stage 1: compile TypeScript to JavaScript
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/server/package.json ./packages/server/
RUN npm ci

COPY packages/server/tsconfig.json ./packages/server/
COPY packages/server/src ./packages/server/src
RUN cd packages/server && ../../node_modules/.bin/tsc

# Stage 2: lean production image
FROM node:22-alpine
WORKDIR /app

COPY packages/server/package.json ./package.json
RUN npm install --omit=dev

COPY --from=builder /app/packages/server/dist ./dist

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "dist/index.js"]
