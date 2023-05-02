
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
RABBITMQ_SERVER_QUEUE_RESOURCE = co_resource
RABBITMQ_SERVER_QUEUE_ALERT = co_alert
RABBITMQ_SERVER_QUEUE_METRIC = co_metric
RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED = co_metric_received
RABBITMQ_SERVER_QUEUE_NCP_RESOURCE = ops_resource
RABBITMQ_SERVER_QUEUE_NCP_METRIC = ops_metric
RABBITMQ_SERVER_USER = user
RABBITMQ_SERVER_PASSWORD = password
RABBITMQ_SERVER_VIRTUAL_HOST = /
RabbitOpt = RABBITMQ_PROTOCOL_HOST + RABBITMQ_SERVER_USER + ":" + RABBITMQ_SERVER_PASSWORD + "@";

AGGREGATOR_URL = http://localhost
AGGREGATOR_PORT = 7001
AGGREGATOR_RESOURCE_URL = /resource
AGGREGATOR_ALERT_URL = /alert
AGGREGATOR_METRIC_META_URL = /metricMeta
AGGREGATOR_METRIC_RECEIVED_URL = /metricReceived

API_SERVER_METRIC_URL = http://localhost
API_SERVER_METRIC_PORT = 8081
API_NAME_METRIC_POST = /service/metric_meta

API_SERVER_ALERT_URL = http://localhost
API_SERVER_ALERT_PORT = 8081
API_NAME_ALERT_POST = /service/alert_rule
```

To execute the service, 

**npm run dev**


