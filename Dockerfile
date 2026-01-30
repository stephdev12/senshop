# Stage 1: Build the frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Stage 2: Setup the backend and serve
FROM node:20-alpine AS runner

WORKDIR /app

# Copy backend package files
COPY server/package.json server/package-lock.json ./server/

# Install backend dependencies
WORKDIR /app/server
RUN npm ci --omit=dev

# Return to app root
WORKDIR /app

# Copy backend source code
COPY server ./server

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Expose the port
ENV PORT=3000
EXPOSE 3000

# Start the server
CMD ["node", "server/server.js"]
