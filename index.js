import dotenv from 'dotenv';
dotenv.config();
import amqp from 'amqplib';
import bodyParser from "body-parser";
import compression from 'compression';
import axios from "axios";
import express from "express";
// import {getResourceQuery} from "./src/resource/ncp/resource.js";

const MAX_API_BODY_SIZE = process.env.MAX_API_BODY_SIZE || "500mb";
const app = express()

app.use(bodyParser.json( {limit: MAX_API_BODY_SIZE} ));
app.use(bodyParser.urlencoded( {limit: MAX_API_BODY_SIZE, extended: true} ));
app.use(compression());
app.get('/health', (req, res)=>{
    res.send ("health check passed");
});

const MQCOMM_PORT = process.env.MQCOMM_PORT || 4001;
//const MQCOMM_HEALTH_PORT = process.env.MQCOMM_HEALTH_PORT || 4012;
const NODE_EXPORTER_PORT = process.env.NODE_EXPORTER_PORT || 9100 ;

const RABBITMQ_PROTOCOL_HOST = process.env.RABBITMQ_PROTOCOL_HOST || "amqp://"
const RABBITMQ_SERVER_URL = process.env.RABBITMQ_SERVER_URL || "olly-dev-mq.claion.io";
// const RABBITMQ_SERVER_URL = process.env.RABBITMQ_SERVER_URL || "localhost";
const RABBITMQ_SERVER_PORT = process.env.RABBITMQ_SERVER_PORT || 5672;
const RABBITMQ_SERVER_QUEUE_RESOURCE = process.env.RABBITMQ_SERVER_QUEUE_RESOURCE || "co_resource";
const RABBITMQ_SERVER_QUEUE_ALERT = process.env.RABBITMQ_SERVER_QUEUE_ALERT || "co_alert";
const RABBITMQ_SERVER_QUEUE_METRIC = process.env.RABBITMQ_SERVER_QUEUE_METRIC || "co_metric";
const RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED = process.env.RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED || "co_metric_received";
const RABBITMQ_SERVER_QUEUE_NCP_RESOURCE = process.env.RABBITMQ_SERVER_QUEUE_NCP_RESOURCE || "ops_resource";
const RABBITMQ_SERVER_QUEUE_NCP_METRIC = process.env.RABBITMQ_SERVER_QUEUE_NCP_METRIC || "ops_metric";
// const RABBITMQ_SERVER_USER = process.env.RABBITMQ_SERVER_USER || "user";
// const RABBITMQ_SERVER_PASSWORD = process.env.RABBITMQ_SERVER_PASSWORD || "cwlO0jDx99Io9fZQ";
// const RABBITMQ_SERVER_VIRTUAL_HOST = process.env.RABBITMQ_SERVER_VIRTUAL_HOST || "/";
const RABBITMQ_SERVER_USER = process.env.RABBITMQ_SERVER_USER || "claion";
const RABBITMQ_SERVER_PASSWORD = process.env.RABBITMQ_SERVER_PASSWORD || "claion";
const RABBITMQ_SERVER_VIRTUAL_HOST = process.env.RABBITMQ_SERVER_VIRTUAL_HOST || "claion";
const RabbitOpt = RABBITMQ_PROTOCOL_HOST + RABBITMQ_SERVER_USER + ":" + RABBITMQ_SERVER_PASSWORD + "@";

const AGGREGATOR_URL = process.env.AGGREGATOR_URL || "http://localhost";
const AGGREGATOR_PORT = process.env.AGGREGATOR_PORT || 6001;
const AGGREGATOR_RESOURCE_URL = process.env.AGGREGATOR_RESOURCE_URL || "/resource";
const AGGREGATOR_ALERT_URL = process.env.AGGREGATOR_ALERT_URL || "/alert";
const AGGREGATOR_METRIC_META_URL = process.env.AGGREGATOR_METRIC_URL || "/metricMeta";
const AGGREGATOR_METRIC_RECEIVED_URL = process.env.AGGREGATOR_METRIC_RECEIVED_URL || "/metricReceived";
const AGGREGATOR_NCP_METRIC_RECEIVED_URL = process.env.AGGREGATOR_NCP_METRIC_RECEIVED_URL || "/metricReceived/ncp";


// 임시 connect 활용
const API_SERVER_METRIC_URL = process.env.API_SERVER_METRIC_URL || "http://olly-dev-connect.claion.io";
const API_SERVER_METRIC_PORT = process.env.API_SERVER_METRIC_PORT || "8081";
const API_NAME_METRIC_POST = process.env.API_NAME_METRIC_POST || "/service/metric_meta";

const API_SERVER_ALERT_URL = process.env.API_SERVER_ALERT_URL || "http://olly-dev-connect.claion.io";
const API_SERVER_ALERT_PORT = process.env.API_SERVER_ALERT_PORT || "8081";
const API_NAME_ALERT_POST = process.env.API_NAME_ALERT_POST || "/service/alert_rule";

const aggregatorResourceUrl = AGGREGATOR_URL + ':' + AGGREGATOR_PORT + AGGREGATOR_RESOURCE_URL
// const aggregatorAlertUrl = AGGREGATOR_URL + ':' + AGGREGATOR_PORT + AGGREGATOR_ALERT_URL
// const aggregatorMetricMetaUrl = AGGREGATOR_URL + ':' + AGGREGATOR_PORT + AGGREGATOR_METRIC_META_URL
const aggregatorAlertUrl = API_SERVER_ALERT_URL + ':' + API_SERVER_ALERT_PORT + API_NAME_ALERT_POST
const aggregatorMetricMetaUrl = API_SERVER_METRIC_URL + ':' + API_SERVER_METRIC_PORT + API_NAME_METRIC_POST
const aggregatorMetricReceivedUrl = AGGREGATOR_URL + ':' + AGGREGATOR_PORT + AGGREGATOR_METRIC_RECEIVED_URL
const aggregatorNcpMetricReceivedUrl = AGGREGATOR_URL + ':' + AGGREGATOR_PORT + AGGREGATOR_NCP_METRIC_RECEIVED_URL


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
    }
}
//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true, exit:true}));
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
        connection = await amqp.connect(connect_string);
        channel = await connection.createChannel();
        // connect to RABBITMQ_SERVER_QUEUE_NAME, create one if doesnot exist already
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_RESOURCE);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_ALERT);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_NCP_RESOURCE);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_NCP_METRIC);
        connection.on('error', function(err) {
            console.error('[AMQP] error', err.message);
        });
        connection.on('close', function() {
            console.log('[AMQP] closed');
            // Channel 닫기
            channel.close(function (err) {
                console.log('[AMQP] channel closed', err);
                // 연결 닫기
                connection.close(function (err) {
                    console.log('[AMQP] connection closed', err);
                });
            });
        });

        await channel.consume(RABBITMQ_SERVER_QUEUE_RESOURCE, async (msg) => {
            try {
                let totalMsg = JSON.parse(msg.content.toString('utf8'));
                const cluster_uuid =  totalMsg.cluster_uuid;
                const service_uuid = totalMsg.service_uuid;

                if (totalMsg.status !== 4) {
                    console.log(`Message ignored, No result in the message in resource channel resource. cluster_uuid: ${cluster_uuid}, service_uuid: ${service_uuid}`);
                    channel.ack(msg);
                    return
                }

                await callAPI(aggregatorResourceUrl, totalMsg)
                channel.ack(msg);
            } catch (err) {
                console.log(err);
                channel.nack(msg, false, false);
            }

        })

        await channel.consume(RABBITMQ_SERVER_QUEUE_ALERT, async (msg) => {
            try {
                let totalMsg = JSON.parse(msg.content.toString('utf-8'));
                const cluster_uuid = totalMsg.cluster_uuid;
                let service_uuid = totalMsg.service_uuid;

                if (totalMsg.status !== 4) {
                    console.log(`Message ignored, No result in the message in resource channel alert. cluster_uuid: ${cluster_uuid}, service_uuid: ${service_uuid}`);
                    channel.ack(msg);
                    return
                }

                await callAPI(aggregatorAlertUrl, totalMsg)
                channel.ack(msg);
            } catch (err) {
                console.error(err);
                channel.nack(msg, false, false);
            }

        }); // end of msg consume

        await channel.consume(RABBITMQ_SERVER_QUEUE_METRIC, async (msg) => {
            try {
                let totalMsg = JSON.parse(msg.content.toString('utf-8'));
                const cluster_uuid = totalMsg.cluster_uuid;
                let service_uuid = totalMsg.service_uuid;

                if (totalMsg.status !== 4) {
                    console.log(`Message ignored, No result in the message in channel metric meta. cluster_uuid: ${cluster_uuid}, service_uuid: ${service_uuid}`);
                    channel.ack(msg);
                    return
                }

                await callAPI(aggregatorMetricMetaUrl, totalMsg)
                channel.ack(msg);
            } catch (err) {
                console.error(err);
                channel.nack(msg, false, false);
            }
        }); // end of msg consume

        await channel.consume(RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED, async (msg) => {
            try {
                let totalMsg = JSON.parse(msg.content.toString('utf-8'));
                const cluster_uuid = totalMsg.cluster_uuid;
                let service_uuid = totalMsg.service_uuid;

                if (totalMsg.status !== 4) {
                    console.log(`Message ignored, No result in the message in metric received. cluster_uuid: ${cluster_uuid}, service_uuid: ${service_uuid}`);
                    channel.ack(msg);
                    return
                    //console.log (result);
                }
                await callAPI(aggregatorMetricReceivedUrl, totalMsg)
                channel.ack(msg);
            } catch (err) {
                console.error(err);
                channel.nack(msg, false, false);
            }
        });

        await channel.consume(RABBITMQ_SERVER_QUEUE_NCP_RESOURCE, async (msg) => {
            try {
                let totalMsg = JSON.parse(msg.content.toString('utf-8'));
                const cluster_uuid = totalMsg.cluster_uuid;
                let service_uuid = totalMsg.service_uuid;

                if (totalMsg.status !== 4) {
                    console.log(`Message ignored, No result in the message in resource. cluster_uuid: ${cluster_uuid}, service_uuid: ${service_uuid}`);
                    channel.ack(msg);
                    return
                    //console.log (result);
                }
                await callAPI(aggregatorResourceUrl, totalMsg)
                channel.ack(msg);
            } catch (err) {
                console.error(err);
                channel.nack(msg, false, false);
            }
        });

        await channel.consume(RABBITMQ_SERVER_QUEUE_NCP_METRIC, async (msg) => {
            try {
                let totalMsg = JSON.parse(msg.content.toString('utf-8'));
                const cluster_uuid = totalMsg.cluster_uuid;
                let service_uuid = totalMsg.service_uuid;

                if (totalMsg.status !== 4) {
                    console.log(`Message ignored, No result in the message in resource channel ncp metric. cluster_uuid: ${cluster_uuid}, service_uuid: ${service_uuid}`);
                    channel.ack(msg);
                    return
                    //console.log (result);
                }
                await callAPI(aggregatorNcpMetricReceivedUrl, totalMsg)
                channel.ack(msg);
            } catch (err) {
                console.error(err);
                channel.nack(msg, false, false);
            }
        });

    } catch (error) {
        console.log ("error", error)
        throw error;
    }
}

async function callAPI(apiURL, apiMsg) {
    await axios.post(apiURL,apiMsg, {maxContentLength:Infinity, maxBodyLength: Infinity})
    .then
    (
      (response) => {
        const responseStatus = "status code: " + response.status;
        console.log(`succeed to call ${apiURL}. responseStatus:  ${responseStatus}`);
      },
      (error) => {
        console.log(`failed to call ${apiURL}. cause: ${error}`);
      })
}

app.listen(MQCOMM_PORT, () => console.log("Claion MQCOMM Server running at port " + MQCOMM_PORT));
