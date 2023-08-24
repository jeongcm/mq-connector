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
const RABBITMQ_SERVER_URL = process.env.RABBITMQ_SERVER_URL || "localhost";
// const RABBITMQ_SERVER_URL = process.env.RABBITMQ_SERVER_URL || "localhost";
const RABBITMQ_SERVER_PORT = process.env.RABBITMQ_SERVER_PORT || 5672;
const RABBITMQ_SERVER_QUEUE_RESOURCE = process.env.RABBITMQ_SERVER_QUEUE_RESOURCE || "";
const RABBITMQ_SERVER_QUEUE_ALERT = process.env.RABBITMQ_SERVER_QUEUE_ALERT || "";
const RABBITMQ_SERVER_QUEUE_METRIC = process.env.RABBITMQ_SERVER_QUEUE_METRIC || "";
const RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED = process.env.RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED || "";
const RABBITMQ_SERVER_QUEUE_NCP_RESOURCE = process.env.RABBITMQ_SERVER_QUEUE_NCP_RESOURCE || "";
const RABBITMQ_SERVER_QUEUE_NCP_METRIC = process.env.RABBITMQ_SERVER_QUEUE_NCP_METRIC || "";
const RABBITMQ_SERVER_QUEUE_NCP_COST = process.env.RABBITMQ_SERVER_QUEUE_NCP_COST || "";
// const RABBITMQ_SERVER_USER = process.env.RABBITMQ_SERVER_USER || "user";
// const RABBITMQ_SERVER_PASSWORD = process.env.RABBITMQ_SERVER_PASSWORD || "PnXbXtsqwzDlFEEd";
// const RABBITMQ_SERVER_VIRTUAL_HOST = process.env.RABBITMQ_SERVER_VIRTUAL_HOST || "/";
const RABBITMQ_SERVER_USER = process.env.RABBITMQ_SERVER_USER || "carrot";
const RABBITMQ_SERVER_PASSWORD = process.env.RABBITMQ_SERVER_PASSWORD || "carrot";
const RABBITMQ_SERVER_VIRTUAL_HOST = process.env.RABBITMQ_SERVER_VIRTUAL_HOST || "carrot";
const RabbitOpt = RABBITMQ_PROTOCOL_HOST + RABBITMQ_SERVER_USER + ":" + RABBITMQ_SERVER_PASSWORD + "@";

const EXPORTER_URL = process.env.EXPORTER_URL || "http://localhost";
const EXPORTER_PORT = process.env.EXPORTER_PORT || 6001;
const EXPORTER_RESOURCE_URL = process.env.EXPORTER_RESOURCE_URL || "/resource";
const EXPORTER_ALERT_URL = process.env.EXPORTER_ALERT_URL || "/alertRule";
const EXPORTER_METRIC_META_URL = process.env.EXPORTER_METRIC_URL || "/metricMeta";
const EXPORTER_METRIC_RECEIVED_URL = process.env.EXPORTER_METRIC_RECEIVED_URL || "/metricReceived";
const EXPORTER_NCP_METRIC_RECEIVED_URL = process.env.EXPORTER_NCP_METRIC_RECEIVED_URL || "/metricReceived/ncp";
const EXPORTER_NCP_COST_URL = process.env.EXPORTER_NCP_COST_URL || "/ncp/cost";


// 임시 connect 활용

const exporterResourceUrl = EXPORTER_URL + ':' + EXPORTER_PORT + EXPORTER_RESOURCE_URL
const exporterAlertUrl = EXPORTER_URL + ':' + EXPORTER_PORT + EXPORTER_ALERT_URL
const exporterMetricMetaUrl = EXPORTER_URL + ':' + EXPORTER_PORT + EXPORTER_METRIC_META_URL
const exporterMetricReceivedUrl = EXPORTER_URL + ':' + EXPORTER_PORT + EXPORTER_METRIC_RECEIVED_URL
const exporterNcpMetricReceivedUrl = EXPORTER_URL + ':' + EXPORTER_PORT + EXPORTER_NCP_METRIC_RECEIVED_URL
const exporterNcpCostReceivedUrl = EXPORTER_URL + ':' + EXPORTER_PORT + EXPORTER_NCP_COST_URL


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
        // const resourceExchange = `ex_${RABBITMQ_SERVER_QUEUE_RESOURCE}`
        // const alertExchange = `ex_${RABBITMQ_SERVER_QUEUE_ALERT}`
        // const metricExchange = `ex_${RABBITMQ_SERVER_QUEUE_METRIC}`
        // const metricReceivedExchange = `ex_${RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED}`
        // const ncpResourceExchange = `ex_${RABBITMQ_SERVER_QUEUE_NCP_RESOURCE}`
        // const ncpMetricExchange = `ex_${RABBITMQ_SERVER_QUEUE_NCP_METRIC}`
        //
        // await channel.assertExchange(RABBITMQ_SERVER_QUEUE_RESOURCE, 'fanout', { durable: false });
        // await channel.assertExchange(RABBITMQ_SERVER_QUEUE_ALERT, 'fanout', { durable: false });
        // await channel.assertExchange(RABBITMQ_SERVER_QUEUE_METRIC, 'fanout', { durable: false });
        // await channel.assertExchange(RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED, 'fanout', { durable: false });
        // await channel.assertExchange(RABBITMQ_SERVER_QUEUE_NCP_RESOURCE, 'fanout', { durable: false });
        // await channel.assertExchange(RABBITMQ_SERVER_QUEUE_NCP_METRIC, 'fanout', { durable: false });

        // connect to RABBITMQ_SERVER_QUEUE_NAME, create one if doesnot exist already
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_RESOURCE);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_ALERT);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_NCP_RESOURCE);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_NCP_METRIC);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_NCP_COST);
        //
        // await channel.bindQueue(RABBITMQ_SERVER_QUEUE_RESOURCE, RABBITMQ_SERVER_QUEUE_RESOURCE, '');
        // await channel.bindQueue(RABBITMQ_SERVER_QUEUE_ALERT, RABBITMQ_SERVER_QUEUE_ALERT, '');
        // await channel.bindQueue(RABBITMQ_SERVER_QUEUE_METRIC, RABBITMQ_SERVER_QUEUE_METRIC, '');
        // await channel.bindQueue(RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED, RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED, '');
        // await channel.bindQueue(RABBITMQ_SERVER_QUEUE_NCP_RESOURCE, RABBITMQ_SERVER_QUEUE_NCP_RESOURCE, '');
        // await channel.bindQueue(RABBITMQ_SERVER_QUEUE_NCP_METRIC, RABBITMQ_SERVER_QUEUE_NCP_METRIC, '');

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

                await callAPI(exporterResourceUrl, totalMsg)
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

                await callAPI(exporterAlertUrl, totalMsg)
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

                await callAPI(exporterMetricMetaUrl, totalMsg)
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
                await callAPI(exporterMetricReceivedUrl, totalMsg)
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
                let aggregatorResourceEventUrl = exporterResourceUrl + '/event'
                if (totalMsg.status !== 4) {
                    console.log(`Message ignored, No result in the message in resource. cluster_uuid: ${cluster_uuid}, service_uuid: ${service_uuid}`);
                    channel.ack(msg);
                    return
                    //console.log (result);
                }

                switch (totalMsg.template_uuid) {
                case 'NCM00000000000000000000000000014':
                    await callAPI(exporterResourceUrl + "/ncpResourceGroup", totalMsg)
                    break;
                case '70000000000000000000000000000029':
                    await callAPI(exporterResourceUrl + "/ncpResource", totalMsg)
                    break;
                case '70000000000000000000000000000033':
                    await callAPI(aggregatorResourceEventUrl, totalMsg)
                    break;
                default:
                    await callAPI(exporterResourceUrl, totalMsg)
                }

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
                    console.log(`Message ignored, No result in the message in resource channel ncp metric. status: ${totalMsg.status}, cluster_uuid: ${cluster_uuid}, service_uuid: ${service_uuid}`);
                    // check error check and post Slack message
                    if (totalMsg.status === 8) {
                        let slackUrl = 'https://hooks.slack.com/services/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'
                        await axios.post(slackUrl,totalMsg, {maxContentLength:Infinity, maxBodyLength: Infinity, headers: { 'Content-Type': 'application/json'}})
                            .then
                            (
                                (response) => {
                                    const responseStatus = "status code: " + response.status;
                                    console.log(`succeed to call ${apiURL}. responseStatus:  ${responseStatus}`);
                                },
                                (error) => {
                                    console.log(`failed to call ${apiURL}. cause: ${error}`);
                                }
                            )
                    }
                    channel.ack(msg);
                    return
                    //console.log (result);
                }
                await callAPI(exporterNcpMetricReceivedUrl, totalMsg)
                channel.ack(msg);
            } catch (err) {
                console.error(err);
                channel.nack(msg, false, false);
            }
        });

        await channel.consume(RABBITMQ_SERVER_QUEUE_NCP_COST, async (msg) => {
            try {
                let totalMsg = JSON.parse(msg.content.toString('utf-8'));
                const cluster_uuid = totalMsg.cluster_uuid;
                let service_uuid = totalMsg.service_uuid;

                if (totalMsg.status !== 4) {
                    console.log(`Message ignored, No result in the message in cost. cluster_uuid: ${cluster_uuid}, service_uuid: ${service_uuid}`);
                    channel.ack(msg);
                    return
                    //console.log (result);
                }

                await callAPI(exporterNcpCostReceivedUrl, totalMsg)

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