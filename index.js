const dontenv = require('dotenv');
dontenv.config();

const express = require("express");
const app = express();
app.use(express.json());

const MQCOMMM_PORT = process.env.MQCOMMM_PORT || 4001;
const RABBITMQ_SERVER_URL = process.env.RABBITMQ_SERVER_URL || "amqp://localhost";
const RABBITMQ_SERVER_PORT = process.env.RABBITMQ_SERVER_PORT || 5672;
const RABBITMQ_SERVER_QUEUE_RESOURCE = process.env.RABBITMQ_SERVER_QUEUE_RESOURCE || "lari_resource";
const RABBITMQ_SERVER_QUEUE_ALERT = process.env.RABBITMQ_SERVER_QUEUE_ALERT || "lari_resource";
const RABBITMQ_SERVER_QUEUE_METRIC = process.env.RABBITMQ_SERVER_QUEUE_METRIC || "lari_metric";

const amqp = require("amqplib");
const axios = require('axios');
var channel, connection;
const connect_string = RABBITMQ_SERVER_URL + ":" + RABBITMQ_SERVER_PORT;

connectQueue() // call connectQueue function
async function connectQueue() {
    try {

        var result = "";  
        connection = await amqp.connect(connect_string);
        channel = await connection.createChannel();

        // connect to RABBITMQ_SERVER_QUEUE_NAME, create one if doesnot exist already
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_RESOURCE);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_ALERT);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC);

        channel.consume(RABBITMQ_SERVER_QUEUE_RESOURCE, (msg) => {
            TotalMsg = JSON.parse(msg.content.toString());
            result = TotalMsg.result;

            serviceName = result.items[0].metadata.name 
            serviceNamespace = result.items[0].metadata.namepsace; 
            serviceInstance = result.items[0].spec.clusterIP + result.items[0].spec.ports.port;
            serviceType = "SV";
            serviceStatus = result.items[0].status;


            //resultItems = result.items;
            //console.log(resultItems); 

            //if (result.status = 4) {
            //    API_MSG = {"cluster_uuid": result.cluster_uuid,
            //              "result": result.result, 
            //             };
            //    callAPI(API_SERVER_RESOURCE_URL+":"+API_SERVER_RESOURCE_PORT, API_MSG );
            //}
            channel.ack(msg);
            console.log("Data sent : ",RABBITMQ_SERVER_QUEUE_RESOURCE);
        })

        channel.consume(RABBITMQ_SERVER_QUEUE_ALERT, (msg) => {
            result = JSON.parse(msg.content.toString());
            if (result.status = 4) {
                API_MSG = {"cluster_uuid": result.cluster_uuid,
                          "result": result.result, 
                         };
                callAPI(API_SERVER_ALERT_URL+":"+API_SERVER_ALERT_PORT, API_MSG );
            }
            channel.ack(data);
            console.log("Data sent : ",RABBITMQ_SERVER_QUEUE_ALERT, API_MSG);
            
        })

        channel.consume(RABBITMQ_SERVER_QUEUE_METRIC, (msg) => {
            result = JSON.parse(msg.content.toString());
            if (result.status = 4) {
                API_MSG = {"cluster_uuid": result.cluster_uuid,
                          "result": result.result, 
                          };
                callAPI(API_SERVER_METRIC_URL+":"+API_SERVER_METRIC_PORT, API_MSG );
            }
            channel.ack(data);
            console.log("Data sent : ",RABBITMQ_SERVER_QUEUE_METRIC, API_MSG );

        })

    } catch (error) {
        console.log(error);
    }
}

async function callAPI(apiURL, apiMsg) {
   
    await axios.post(apiURL,apiMsg)
    .then
    (
      (response) => {
        const status = response.data.status;
        console.log("api called", status);
      },
      (error) => {
        console.log("error due to unexpoected error: ", error);
      })

}


app.listen(MQCOMMM_PORT, () => console.log("Server running at port " + MQCOMMM_PORT));