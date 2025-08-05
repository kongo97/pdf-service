FROM node:20-alpine AS base

# Install dependencies for pdf2pic and tesseract
RUN apk add --no-cache \
    graphicsmagick \
    ghostscript \
    poppler-utils \
    tesseract-ocr

WORKDIR /usr/src/app

# Development stage
FROM base AS development
COPY ./app/package*.json ./
RUN npm ci
COPY ./app .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Production stage
FROM base AS production
COPY ./app .
RUN npm ci
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main"]
