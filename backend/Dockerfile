# Use official Node LTS image for building
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies (including dev deps needed for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build (Nest compiles TS to JS in dist)
RUN npm run build

# Runtime image
FROM node:18-alpine
WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy built output
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/main.js"]
