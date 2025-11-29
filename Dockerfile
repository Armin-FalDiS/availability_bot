FROM node:18-alpine

WORKDIR /app

# Install curl
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Start the app (migrations run automatically)
CMD ["npm", "start"]
