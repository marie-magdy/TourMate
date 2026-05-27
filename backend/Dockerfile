FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production || npm install --production --legacy-peer-deps

# Copy source
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# Add a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["node", "src/index.js"]
