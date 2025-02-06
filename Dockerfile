FROM node:23-alpine AS builder
LABEL maintainer="preston.lee@prestonlee.com"

# Install dependencies first so they layer can be cached across builds.
RUN mkdir /build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm i

# Build content manifest file
COPY . .
RUN npx ts-node src/bin/vha-kbs-fhir.ts metadata-extract --content . manifest.json
RUN npx ts-node src/bin/vha-kbs-fhir.ts stack-create manifest.json stack.json

# FROM nginx:stable-alpine
# WORKDIR /usr/share/nginx/html

# # We need to make a few changes to the default configuration file.
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# # Remove any default nginx content
# RUN rm -rf *

# # Copy only the content directory from the "builder" stage
# COPY --from=builder /build/data data
# COPY --from=builder /build/content content

FROM p3000/skycapp-fhir-stack-controller:latest
LABEL maintainer="preston.lee@prestonlee.com"
# # Copy only the content directory from the "builder" stage
COPY --from=builder /build/data data
COPY --from=builder /build/content content
COPY --from=builder /build/manifest.json manifest.json
COPY --from=builder /build/stack.json stack.json
