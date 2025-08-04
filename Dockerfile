FROM node:20-alpine

WORKDIR /usr/src/app

COPY ./app .

RUN npm ci

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main"]
