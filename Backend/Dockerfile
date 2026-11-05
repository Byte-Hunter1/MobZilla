FROM node:22-alpine

# Install FFmpeg and curl (for native video processing and healthchecks)
RUN apk add --no-cache ffmpeg curl

WORKDIR /app

# Install dependencies first for Docker caching
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Ensure storage directory exists
RUN mkdir -p storage/uploads

EXPOSE 4000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

CMD ["node", "dist/index.js"]

