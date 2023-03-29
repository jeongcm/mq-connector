const dontenv = require('dotenv');
dontenv.config();
const amqp= require("amqplib");
const compression = require('compression');
const bodyParser = require('body-parser');
const axios = require('axios');
const express = require("express");
const MAX_API_BODY_SIZE = process.env.MAX_API_BODY_SIZE || "500mb"; 

require( 'console-stamp' )( console, {
    format: '(console).yellow :date().green.underline :label(7)'
  } );

const app = express();
app.use(bodyParser.json( {limit: MAX_API_BODY_SIZE} ));
app.use(bodyParser.urlencoded( {limit: MAX_API_BODY_SIZE} ));
app.use(compression());
app.get('/health', (req, res)=>{
    res.send ("health check passed");
});


const MQCOMM_PORT = process.env.MQCOMM_PORT || 7001;
const RABBITMQ_PROTOCOL_HOST = process.env.RABBITMQ_PROTOCOL_HOST || "amqp://"
const RABBITMQ_SERVER_URL = process.env.RABBITMQ_SERVER_URL || "localhost";
const RABBITMQ_SERVER_PORT = process.env.RABBITMQ_SERVER_PORT || 5672;
const RABBITMQ_SERVER_QUEUE_RESOURCE = process.env.RABBITMQ_SERVER_QUEUE_RESOURCE || "co_resource";
const RABBITMQ_SERVER_QUEUE_ALERT = process.env.RABBITMQ_SERVER_QUEUE_ALERT || "co_alert";
const RABBITMQ_SERVER_QUEUE_METRIC_META = process.env.RABBITMQ_SERVER_QUEUE_METRIC || "co_metric";
const RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED = process.env.RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED || "co_metric_received";
const RABBITMQ_SERVER_USER = process.env.RABBITMQ_SERVER_USER || "claion";
const RABBITMQ_SERVER_PASSWORD = process.env.RABBITMQ_SERVER_PASSWORD || "claion";
const RABBITMQ_SERVER_VIRTUAL_HOST = process.env.RABBITMQ_SERVER_VIRTUAL_HOST || "claion";
const RabbitOpt = RABBITMQ_PROTOCOL_HOST + RABBITMQ_SERVER_USER + ":" + RABBITMQ_SERVER_PASSWORD + "@";

const AGGREGATOR_URL = process.env.AGGREGATOR_URL || "http://localhost";
const AGGREGATOR_PORT = process.env.AGGREGATOR_PORT || "4001";
const AGGREGATOR_RESOURCE_URL = process.env.AGGREGATOR_RESOURCE_URL || "/resourceMass";
const AGGREGATOR_ALERT_URL = process.env.AGGREGATOR_ALERT_URL || "/alertMass";
const AGGREGATOR_METRIC_META_URL = process.env.AGGREGATOR_METRIC_URL || "/metricMetaMass";
const AGGREGATOR_METRIC_RECEIVED_URL = process.env.AGGREGATOR_METRIC_RECEIVED_URL || "/metricReceivedMass";

const aggregatorResourceUrl = AGGREGATOR_URL + AGGREGATOR_PORT + AGGREGATOR_RESOURCE_URL
const aggregatorAlertUrl = AGGREGATOR_URL + AGGREGATOR_PORT + AGGREGATOR_ALERT_URL
const aggregatorMetricMetaUrl = AGGREGATOR_URL + AGGREGATOR_PORT + AGGREGATOR_METRIC_META_URL
const aggregatorMetricReceivedUrl = AGGREGATOR_URL + AGGREGATOR_PORT + AGGREGATOR_METRIC_RECEIVED_URL

var channel, connection;
const connect_string = RabbitOpt + RABBITMQ_SERVER_URL + ":" + RABBITMQ_SERVER_PORT + "/" + RABBITMQ_SERVER_VIRTUAL_HOST + "?heartbeat=180";

process.stdin.resume();//so the program will not close instantly
function exitHandler(options, exitCode) {
    if (options.cleanup) console.log('clean');
    if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) {
        channel.cancel()
        channel.close()
        connection.close()
        process.exit(0)
    };
}
//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));
//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));
// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));
//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
process.on('SIGTERM', exitHandler.bind(null, {exit:true}));


connectQueue()

async function connectQueue() {
    try {
        var result = "";
        connection = await amqp.connect(connect_string);
        channel = await connection.createChannel();
        // connect to RABBITMQ_SERVER_QUEUE_NAME, create one if doesnot exist already
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_RESOURCE);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_ALERT);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC_META);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED);
        await channel.consume(RABBITMQ_SERVER_QUEUE_RESOURCE, (msg) => {
            let totalMsg = JSON.parse(msg.content.toString('utf8'));
            let status = totalMsg.status;
            if (status === 4) {
                if (!totalMsg.result) {
                    console.log("Message ignored, No result in the message in resource channel msg");
                    channel.ack(msg);
                    return
                }

                callAPI(aggregatorResourceUrl, totalMsg.result)
            }
        })

        await channel.consume(RABBITMQ_SERVER_QUEUE_ALERT, (msg) => {
            let totalMsg = JSON.parse(msg.content.toString('utf-8'));
            if (totalMsg.status !== 4) {
                console.log("Message ignored, No result in the message in resource channel alert");
                channel.ack(msg);
                return
                //console.log (result);
            }
            callAPI(aggregatorAlertUrl, totalMsg.result)
        }); // end of msg consume

        await channel.consume(RABBITMQ_SERVER_QUEUE_METRIC_META, (msg) => {
            let totalMsg = JSON.parse(msg.content.toString('utf-8'));
            if (totalMsg.status !== 4) {
                console.log("Message ignored, No result in the message in resource channel metric meta");
                channel.ack(msg);
                return
            }

            callAPI(aggregatorMetricMetaUrl, totalMsg.result)
        }); // end of msg consume

        await channel.consume(RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED, (msg) => {
            let totalMsg = JSON.parse(msg.content.toString('utf-8'));
            if (totalMsg.status !== 4) {
                console.log("Message ignored, No result in the message in resource channel alert");
                channel.ack(msg);
                return
                //console.log (result);
            }
            callAPI(aggregatorMetricReceivedUrl, totalMsg.result)
        });

    } catch (error) {
        console.log ("error", error)
        throw error;
    }
}

async function callAPI(apiURL, apiMsg) {
    axios.post(apiURL,apiMsg, {maxContentLength:Infinity, maxBodyLength: Infinity})
    .then
    (
      (response) => {
        const responseStatus = "status code: " + response.status;
        console.log("API called: ", apiURL, " ", responseStatus);
      },
      (error) => {
        console.log("API error due to unexpoected error: ", apiURL, " ", error);
      })
}

app.listen(MQCOMM_PORT, () => console.log("NexClipper MQCOMM Server running at port " + MQCOMM_PORT));
