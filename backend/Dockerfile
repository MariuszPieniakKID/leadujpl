FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
# Use npm install to avoid requiring a lockfile in this subpackage
RUN npm install --omit=dev && npm cache clean --force

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npm run prisma:generate && npm run build \
  && mkdir -p dist/data \
  && cp -r src/data/* dist/data/

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./
EXPOSE 4000
# Run migrations before starting the server
CMD ["sh", "-c", "echo '🔄 Running Prisma migrations...' && npx prisma migrate deploy --schema prisma/schema.prisma && echo '✅ Migrations completed!' && echo '🚀 Starting server...' && node dist/server.js"]


