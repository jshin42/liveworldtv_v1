FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/*/package*.json ./packages/*/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build:web

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:web"]