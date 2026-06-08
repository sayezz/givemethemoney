FROM docker.io/library/node:18-alpine as build

WORKDIR /app

COPY package*.json ./

RUN npm config set fetch-retries 5 && \
	npm config set fetch-retry-mintimeout 20000 && \
	npm config set fetch-retry-maxtimeout 120000 && \
	npm install

COPY . .

RUN npm run build

FROM docker.io/library/nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
