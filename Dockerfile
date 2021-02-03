FROM node:12-slim

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci --production
RUN npm cache clean --force

COPY ./lib lib
COPY ormconfig.js ./

ENV NODE_ENV="production"
EXPOSE 3000

CMD [ "npm", "start" ]