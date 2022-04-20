# Common build stage
FROM node:lts-alpine as common-build-stage

WORKDIR /usr/src/app

COPY  ./package.json ./package-lock.json  /usr/src/app/


EXPOSE 4001

##Development build stage
FROM common-build-stage as development-build-stage

RUN npm ci

COPY . /usr/src/app/


ENV NODE_ENV development

CMD [ "npm", "run", "dev"]

# Production build stage
# FROM common-build-stage as production-build-stage

# RUN npm ci --only=production

# COPY . /usr/src/app/

# ENTRYPOINT [ "docker-entrypoint.sh" ]

# ENV NODE_ENV production

# CMD [ "npm", "run", "start"]
