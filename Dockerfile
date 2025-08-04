FROM node:20-alpine AS base

WORKDIR /usr/src/app

COPY ./app/package*.json ./

# Development stage
FROM base AS development

RUN npm ci

COPY ./app .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]

# Production stage
FROM base AS production

RUN npm ci --only=production

COPY ./app .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main"]
