FROM node:18-alpine

# Install ffmpeg for audio processing
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm ci

# Copy rest of the application
COPY . .

# Expose API port
EXPOSE 3000

# Start command
CMD ["npm", "start"]