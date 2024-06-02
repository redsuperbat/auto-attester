FROM node:alpine

COPY . .

RUN yarn install

CMD ["yarn", "prod"]
