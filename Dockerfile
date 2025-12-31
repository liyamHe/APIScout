# Multi-stage Dockerfile for APIScout
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files and install dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

# Go back to root and copy all backend code
WORKDIR /app
COPY backend/ ./backend/

# Create logs directory for volume mount
RUN mkdir -p /app && touch /app/logs.json

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the server
CMD ["node", "backend/server.js"]
