
# nexclipper-mqcomm

This is a RabbitMQ communicator between RabbitMQ and services - to populate K8s resources, P8s alert rules and metrics to the database. it requires the configurations of RabbitMQ queues for alert, resource, metrics as well as APIs for these. 


![archi.png](https://github.com/NexClipper/nexclipper-mqcomm/blob/ebd65844eb7021fe83960d346f896b31378f2adc/assets/archi.png)



Here is a sample .env files 

```
RABBITMQ_SERVER_URL=amqp://localhost
RABBITMQ_SERVER_PORT=5672
MQCOMMM_PORT=4010
RABBITMQ_SERVER_QUEUE_RESOURCE=lari_resource
RABBITMQ_SERVER_QUEUE_ALERT=lari_alert
RABBITMQ_SERVER_QUEUE_METRIC=lari_metric
API_SERVER_RESOURCE_URL=
API_SERVER_RESOURCE_PORT=
API_SERVER_ALERT_URL=
API_SERVER_ALERT_PORT=
API_SERVER_METRIC_URL=
API_SERVER_METRIC_PORT=
API_NAME_RESOURCE_POST=
API_NAME_ALERT_POST=
API_NAME_METRIC_POST=
NODE_EXPORTER_PORT=9090
```

To execute the service, 

**node index.js**
