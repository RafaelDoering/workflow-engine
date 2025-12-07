FROM node:20-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate

RUN npm run build api

FROM node:20-alpine AS production

ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

COPY --from=development /usr/src/app/dist ./dist
COPY --from=development /usr/src/app/generated ./generated

CMD ["node", "dist/apps/api/main"]
