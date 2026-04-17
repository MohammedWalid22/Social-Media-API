# Stage 1: Builder
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Stage 2: Production
FROM node:18-alpine

# Install ffmpeg for audio processing
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Install ONLY production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy necessary application files from builder stage
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.js ./
COPY --from=builder /app/scripts ./scripts

# Set production environment
ENV NODE_ENV=production

# Switch to non-root user for better security
# Creating a dummy user is standard practice
USER node

# Expose API port
EXPOSE 3000

# Start command
CMD ["npm", "start"]