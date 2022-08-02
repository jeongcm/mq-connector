# Common build stage
FROM node:lts-alpine as common-build-stage

ENV WORKDIR=/usr/src/app/ \
    NAME=nexclipper-mqcomm \
    USER=nexclipperuser \
    USER_ID=1002 \
    GROUP=nexclipper 

WORKDIR ${WORKDIR}

COPY  ./package.json ./package-lock.json  ${WORKDIR}

COPY docker-entrypoint.sh ${WORKDIR}

RUN chmod +x  ${WORKDIR}docker-entrypoint.sh 
RUN npm ci

COPY . ${WORKDIR}

RUN addgroup ${GROUP} && \
    adduser -D ${USER} -g ${GROUP} -u ${USER_ID} && \
    chown -R ${USER}:${GROUP} ${WORKDIR}

USER ${USER}

EXPOSE 4001

##Development build stage
FROM common-build-stage as development-build-stage

ENV NODE_ENV development

CMD [ "npm","run","dev" ]

# Production build stage
FROM common-build-stage as production-build-stage

ENV NODE_ENV production

ENTRYPOINT [ "./docker-entrypoint.sh" ]

