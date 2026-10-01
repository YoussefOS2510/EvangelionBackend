# Production Multi-Stage Dockerfile for Evangelion Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled JavaScript and necessary assets
COPY --from=builder /app/dist ./dist
COPY src/db/migrations ./dist/db/migrations
COPY src/db/seeds ./dist/db/seeds
COPY src/db/bible_data.json ./dist/db/bible_data.json
COPY src/db/bible_data.json ./src/db/bible_data.json

EXPOSE 3000

CMD ["node", "dist/server.js"]
