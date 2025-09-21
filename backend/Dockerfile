# Use Node.js LTS
FROM node:20

# Set working directory
WORKDIR /app

# Copy package.json + package-lock.json first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the backend code
COPY . .

# Expose Cloud Run port
ENV PORT=8080
EXPOSE 8080

# Start server
CMD ["npm", "start"]
