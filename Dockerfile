# syntax=docker/dockerfile:1.7

# Use an official Node.js image as base image
FROM node:22

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install dependencies. Supply an internal registry CA with
# `docker build --secret id=npm_ca,src=/path/to/registry-ca.pem ...`.
RUN --mount=type=secret,id=npm_ca,required=false \
    if [ -s /run/secrets/npm_ca ]; then npm config set cafile /run/secrets/npm_ca; fi \
    && npm ci --omit=dev

# Copy the rest of the application files
COPY . .

# Specify the command to run when the container starts
CMD ["npm", "start"]