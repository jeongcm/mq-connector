
=======
# mqcomm

This is a RabbitMQ connector between RabbitMQ and services - to populate K8s resources, P8s alert rules and metrics to the database. it requires the configurations of RabbitMQ queues for alert, resource, metrics as well as APIs for these.

Here is a sample .env files 

```
MQCOMM_PORT =
MQCOMM_HEALTH_PORT =
NODE_EXPORTER_PORT =

RABBITMQ_PROTOCOL_HOST =
RABBITMQ_SERVER_URL =
RABBITMQ_SERVER_URL =
RABBITMQ_SERVER_PORT =
RABBITMQ_SERVER_QUEUE_RESOURCE = 
RABBITMQ_SERVER_QUEUE_ALERT = 
RABBITMQ_SERVER_QUEUE_METRIC = 
RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED = 
RABBITMQ_SERVER_QUEUE_NCP_RESOURCE = 
RABBITMQ_SERVER_QUEUE_NCP_METRIC = 
RABBITMQ_SERVER_USER = user
RABBITMQ_SERVER_PASSWORD = password
RABBITMQ_SERVER_VIRTUAL_HOST = /
RabbitOpt = RABBITMQ_PROTOCOL_HOST + RABBITMQ_SERVER_USER + ":" + RABBITMQ_SERVER_PASSWORD + "@";

EXPORTER_URL = http://localhost
EXPORTER_PORT = 7001
EXPORTER_RESOURCE_URL = /resource
EXPORTER_ALERT_URL = /alert
EXPORTER_METRIC_META_URL = /metricMeta
EXPORTER_METRIC_RECEIVED_URL = /metricReceived
```

To execute the service, 

**npm run dev**


