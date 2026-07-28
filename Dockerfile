FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev --silent

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create upload directory
RUN mkdir -p uploads logs

EXPOSE 5000

# Run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
