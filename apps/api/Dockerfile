FROM node:22-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN chmod +x start.sh
EXPOSE 3001
CMD ["./start.sh"]
