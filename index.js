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
var channel, connection;
const connect_string = RABBITMQ_SERVER_URL + ":" + RABBITMQ_SERVER_PORT;

connectQueue() // call connectQueue function
async function connectQueue() {
    try {

        connection = await amqp.connect(connect_string);
        channel = await connection.createChannel();

        // connect to RABBITMQ_SERVER_QUEUE_NAME, create one if doesnot exist already
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_RESOURCE);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_ALERT);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC);

        channel.consume(RABBITMQ_SERVER_QUEUE_RESOURCE, data => {
            console.log("Data received : ",RABBITMQ_SERVER_QUEUE_RESOURCE, `${Buffer.from(data.content)}` );
            channel.ack(data);
        })

        channel.consume(RABBITMQ_SERVER_QUEUE_ALERT, data => {
            console.log("Data received : ",RABBITMQ_SERVER_QUEUE_ALERT, `${Buffer.from(data.content)}` );
            channel.ack(data);
        })

        channel.consume(RABBITMQ_SERVER_QUEUE_METRIC, data => {
            console.log("Data received : ",RABBITMQ_SERVER_QUEUE_METRIC, `${Buffer.from(data.content)}` );
            channel.ack(data);
        })

    } catch (error) {
        console.log(error);
    }
}



app.listen(MQCOMMM_PORT, () => console.log("Server running at port " + MQCOMMM_PORT));