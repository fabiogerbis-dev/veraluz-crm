FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./
RUN npm install

COPY public ./public
COPY src ./src
COPY img ./img
COPY .eslintrc.json ./
COPY .prettierrc.json ./
COPY jsconfig.json ./

RUN npm run build

FROM nginx:1.29-alpine

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80
