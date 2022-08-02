#!/bin/sh 


if [[ -f /vault/secrets/ncmq-admin-login ]]; then
    source /vault/secrets/ncmq-admin-login
    export RABBITMQ_SERVER_USER="${RABBITMQ_SERVER_USER}"
    export RABBITMQ_SERVER_PASSWORD="${RABBITMQ_SERVER_PASSWORD}"
fi

npm run start


