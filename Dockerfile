FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG PUBLIC_CF_TURNSTILE_SITE_KEY=""
ENV PUBLIC_CF_TURNSTILE_SITE_KEY=$PUBLIC_CF_TURNSTILE_SITE_KEY
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 8086
CMD ["nginx", "-g", "daemon off;"]
