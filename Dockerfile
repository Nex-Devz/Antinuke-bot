FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY src/ ./src/
COPY config.json ./

RUN mkdir -p data

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
