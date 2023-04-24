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


const MQCOMM_PORT = process.env.MQCOMM_PORT || 5001;
const RABBITMQ_PROTOCOL_HOST = process.env.RABBITMQ_PROTOCOL_HOST || "amqp://"
const RABBITMQ_SERVER_URL = process.env.RABBITMQ_SERVER_URL || "localhost";
const RABBITMQ_SERVER_PORT = process.env.RABBITMQ_SERVER_PORT || 5672;
const RABBITMQ_SERVER_QUEUE_RESOURCE = process.env.RABBITMQ_SERVER_QUEUE_RESOURCE || "co_resource";
const RABBITMQ_SERVER_QUEUE_ALERT = process.env.RABBITMQ_SERVER_QUEUE_ALERT || "co_alert";
const RABBITMQ_SERVER_QUEUE_METRIC = process.env.RABBITMQ_SERVER_QUEUE_METRIC || "co_metric";
const RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED = process.env.RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED || "co_metric_received";
const RABBITMQ_SERVER_QUEUE_RESOURCE_OPS = process.env.RABBITMQ_SERVER_QUEUE_RESOURCE_OPS || "ops_resource";
const RABBITMQ_SERVER_QUEUE_METRIC_OPS = process.env.RABBITMQ_SERVER_QUEUE_METRIC_OPS || "ops_metric";
// const RABBITMQ_SERVER_USER = process.env.RABBITMQ_SERVER_USER || "claion";
// const RABBITMQ_SERVER_PASSWORD = process.env.RABBITMQ_SERVER_PASSWORD || "claion";
// const RABBITMQ_SERVER_VIRTUAL_HOST = process.env.RABBITMQ_SERVER_VIRTUAL_HOST || "claion";

const RABBITMQ_SERVER_USER = process.env.RABBITMQ_SERVER_USER || "user";
const RABBITMQ_SERVER_PASSWORD = process.env.RABBITMQ_SERVER_PASSWORD || "cwlO0jDx99Io9fZQ";
const RABBITMQ_SERVER_VIRTUAL_HOST = process.env.RABBITMQ_SERVER_VIRTUAL_HOST || "/";

const RabbitOpt = RABBITMQ_PROTOCOL_HOST + RABBITMQ_SERVER_USER + ":" + RABBITMQ_SERVER_PASSWORD + "@";

const AGGREGATOR_URL = process.env.AGGREGATOR_URL || "http://localhost";
const AGGREGATOR_PORT = process.env.AGGREGATOR_PORT || 7001;
const AGGREGATOR_RESOURCE_URL = process.env.AGGREGATOR_RESOURCE_URL || "/resource";
const AGGREGATOR_ALERT_URL = process.env.AGGREGATOR_ALERT_URL || "/alert";
const AGGREGATOR_METRIC_META_URL = process.env.AGGREGATOR_METRIC_URL || "/metricMeta";
const AGGREGATOR_METRIC_RECEIVED_URL = process.env.AGGREGATOR_METRIC_RECEIVED_URL || "/metricReceived";

const aggregatorResourceUrl = AGGREGATOR_URL + ':' + AGGREGATOR_PORT + AGGREGATOR_RESOURCE_URL
const aggregatorAlertUrl = AGGREGATOR_URL + ':' + AGGREGATOR_PORT + AGGREGATOR_ALERT_URL
const aggregatorMetricMetaUrl = AGGREGATOR_URL + ':' + AGGREGATOR_PORT + AGGREGATOR_METRIC_META_URL
const aggregatorMetricReceivedUrl = AGGREGATOR_URL + ':' + AGGREGATOR_PORT + AGGREGATOR_METRIC_RECEIVED_URL

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
        let result = "";
        connection = await amqp.connect(connect_string);
        channel = await connection.createChannel();
        // connect to RABBITMQ_SERVER_QUEUE_NAME, create one if doesnot exist already
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_RESOURCE);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_ALERT);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_RESOURCE_OPS);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC_OPS);
        connection.on('error', function(err) {
            console.error('[AMQP] error', err.message);
        });
        connection.on('close', function() {
            console.log('[AMQP] closed');
            // Channel 닫기
            channel.close(function (err) {
                console.log('[AMQP] channel closed');
                // 연결 닫기
                connection.close(function (err) {
                    console.log('[AMQP] connection closed');
                });
            });
        });

        await channel.consume(RABBITMQ_SERVER_QUEUE_RESOURCE, async (msg) => {
            try {
                let resourceType;
                let query = {};
                let mergedQuery = {};
                let tempQuery = {};
                let API_MSG = {};
                let TotalMsg = JSON.parse(msg.content.toString('utf8'));
                const cluster_uuid =  TotalMsg.cluster_uuid;
                const template_uuid = TotalMsg.template_uuid;
                const service_uuid = TotalMsg.service_uuid;
                console.log("carrot service_uuid: ", service_uuid)
                let status = TotalMsg.status;
                if (status == 4) {
                    if (!TotalMsg.result)
                    {
                        console.log("Message ignored, No result in the message.: " + template_uuid + ", cluster_uuid: " + cluster_uuid, ", service_uuid: ", service_uuid);
                        channel.ack(msg);
                        TotalMsg="";
                        return;
                    }
                    //let result = JSON.parse(TotalMsg.result);
                    let itemLength = 0;
                    let result = TotalMsg.result;
                    let length = 0;
                    if (template_uuid !== "50000000000000000000000000000002" && template_uuid !== "50000000000000000000000000000004" && template_uuid !== "50000000000000000000000000000003") {
                        itemLength = result.items.length;
                        if (itemLength == 0)
                        {
                            console.log("Message ignored, no instance for resource, from the msg, template uuid: " + template_uuid + ", cluster_uuid: " + cluster_uuid, ", service_uuid: ", service_uuid );
                            channel.ack(msg);
                            return;
                        }
                    }


                    switch (template_uuid) {
                        case "00000000000000000000000000000020":  //20, for K8s services
                            resourceType = "SV";
                            let resultPortsLength;
                            let resultPort = 0
                            for (let i=0; i<itemLength; i++)
                            {
                                tempQuery = {};
                                // get port number from port array and assign to resultPort letiable.
                                resultPortsLength = result.items[i].spec.ports.length
                                for (let j=0; j<resultPortsLength; j++)
                                {
                                    if (result.items[i].spec.ports[j].key = 'port')
                                    {
                                        resultPort = result.items[i].spec.ports[j].port;
                                    }
                                }
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Namespace'] = result.items[i].metadata.namespace;
                                query['resource_Instance'] = result.items[i].spec.clusterIP + ":" + resultPort;
                                query['resource_Status'] = result.items[i].status; //object
                                query['resource_Level1'] = "K8";
                                query['resource_Level2'] = "NS";
                                query['resource_Level3'] = resourceType;
                                query['resource_Level4'] = resourceType;
                                query['resource_Level_Type'] = "KS";
                                query['resource_Rbac'] = true;
                                query['resource_Anomaly_Monitor'] = true;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);
                            break;

                        case "00000000000000000000000000000010":  //10, for K8s nodes
                            resourceType = "ND";
                            for (let i=0; i<itemLength; i++)
                            {
                                // get internal IP address from addresses array and assign to InternalIP letiable.
                                let internalIpLength = result.items[i].status.addresses.length
                                let internalIp = "";
                                for (let j=0; j<internalIpLength; j++)
                                {
                                    if (result.items[i].status.addresses[j].type == 'InternalIP')
                                    {
                                        let ipHeader = (result.items[i].status.addresses[j].address).substr(0,3);
                                        if (ipHeader=="10." || ipHeader=="192" || ipHeader=="172" ) {
                                            internalIp = result.items[i].status.addresses[j].address;
                                            break;
                                        }
                                        //find internal IP address of node using the first part of ip address 10 or 192
                                    }
                                }
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Instance'] = internalIp + ":" + NODE_EXPORTER_PORT;
                                query['resource_Status'] = result.items[i].status; //object
                                query['resource_Level1'] = "K8";
                                query['resource_Level2'] = resourceType;
                                query['resource_Level4'] = resourceType;
                                query['resource_Level_Type'] = "KN";
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();
                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);
                            break;

                        case "00000000000000000000000000000004":  //04, for K8s namespaces
                            resourceType = "NS";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Status'] = result.items[i].status; //object
                                query['resource_Level1'] = "K8";
                                query['resource_Level2'] = resourceType;
                                //query['resource_Level3'] = "SV";
                                query['resource_Level_Type'] = "KS";
                                query['resource_Rbac'] = true;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);
                            break;

                        case "00000000000000000000000000000002":  //02, for K8s pods
                            resourceType = "PD";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Namespace'] = result.items[i].metadata.namespace;
                                query['resource_Instance'] = result.items[i].status.podIP;
                                query['resource_Pod_Phase'] = result.items[i].status.phase;
                                query['resource_Pod_Container'] = result.items[i].spec.containers; //array
                                query['resource_Pod_Volume'] = result.items[i].spec.volumes; //array
                                query['resource_Status'] = result.items[i].status; //object
                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = "ND"; //Node
                                query['resource_Level3'] = resourceType; //Pod
                                query['resource_Level4'] = resourceType; //for MetricOps
                                query['resource_Level_Type'] = "KN";  //K8s-Nodes-Pods
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = true;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();
                                query['resource_App'] = result.items[i].metadata.labels?.["app.kubernetes.io/name"] || result.items[i].metadata.labels?.app || result.items[i].metadata.labels?.["k8s-app"] || result.items[i].metadata.labels?.name || ''; //array
                                //console.log('app---------',query['resource_App'] + query['resource_Name'] );
                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);
                            break;

                        case "00000000000000000000000000001002":  //1002, for K8s deployment
                            resourceType = "DP";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Namespace'] = result.items[i].metadata.namespace;
                                query['resource_Match_Labels'] = result.items[i].spec.selector.matchLabels; //object
                                query['resource_Status'] = result.items[i].status; //object
                                query['resource_Replicas'] = result.items[i].spec.replicas;
                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = "NS"; //Namespace
                                query['resource_Level3'] = resourceType; //Deployment
                                query['resource_Level4'] = "WL"; //Workload / MetricOps
                                query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);
                            break;

                        case "00000000000000000000000000001004":  //1004, for K8s statefulset
                            resourceType = "SS";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Namespace'] = result.items[i].metadata.namespace;
                                query['resource_Sts_Replicas'] = result.items[i].spec.replicas;
                                query['resource_Replicas'] = result.items[i].spec.replicas;
                                query['resource_Sts_Volume_Claim_Templates'] = result.items[i].spec.volumeClaimTemplates; //array
                                query['resource_Match_Labels'] = result.items[i].spec.selector.matchLabels;
                                query['resource_Status'] = result.items[i].status; //object
                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = "NS"; //Namespace
                                query['resource_Level3'] = resourceType; //Deployment
                                query['resource_Level4'] = "WL"; //Workload //MetricOps
                                query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);
                            // console.log(API_MSG);
                            break;

                        case "00000000000000000000000000001006":  //1006, for K8s daemonset
                            resourceType = "DS";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Namespace'] = result.items[i].metadata.namespace;
                                query['resource_Match_Labels'] = result.items[i].spec.selector.matchLabels; //object
                                query['resource_Status'] = result.items[i].status; //object
                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = "NS"; //Namespace
                                query['resource_Level3'] = resourceType; //Deployment
                                query['resource_Level4'] = "WL"; //Workload // MetricOps
                                query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);
                            break;

                        case "00000000000000000000000000001008":  //1008, for K8s replicaset

                            resourceType = "RS";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Namespace'] = result.items[i].metadata.namespace;
                                query['resource_Replicas'] = result.items[i].spec.replicas;
                                query['resource_Match_Labels'] = result.items[i].spec.selector.matchLabels; //object
                                query['resource_Status'] = result.items[i].status; //object
                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = "NS"; //Namespace
                                query['resource_Level3'] = resourceType; //Replicaset
                                query['resource_Level4'] = "WL"; //Workload // MetricOps
                                query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);
                            break;

                        case "00000000000000000000000000000018":  //18, for K8s pvc

                            resourceType = "PC";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Namespace'] = result.items[i].metadata.namespace;
                                query['resource_Pvc_Storage'] = result.items[i].spec.resources; //object
                                query['resource_Pvc_Volume_Name'] = result.items[i].spec.volumeName;
                                query['resource_Pvc_Storage_Class_Name'] = result.items[i].spec.storageClassName;
                                query['resource_Pvc_Volume_Mode'] = result.items[i].spec.volumeMode;
                                query['resource_Status'] = result.items[i].status; //object
                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = "NS"; //Namespace
                                query['resource_Level3'] = resourceType; //Persistent Volume Claim
                                query['resource_Level4'] = resourceType; //for MetricOps
                                query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);
                            break;

                        case "00000000000000000000000000000014":  //14, for K8s secret
                            resourceType = "SE";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Namespace'] = result.items[i].metadata.namespace;
                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = "NS"; //Namespace
                                query['resource_Level3'] = resourceType; //Secert
                                query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);
                            break;

                        case "00000000000000000000000000000016":  //16, for K8s endpoint
                            resourceType = "EP";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Namespace'] = result.items[i].metadata.namespace;
                                query['resource_Endpoint'] = result.items[i].subsets; //array
                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = "NS"; //Namespace
                                query['resource_Level3'] = resourceType; //Endpoint
                                query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);

                            break;

                        case "00000000000000000000000000000006":  //06, for K8s configmap
                            resourceType = "CM";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Namespace'] = result.items[i].metadata.namespace;
                                query['resource_Configmap_Data'] = result.items[i].data; //object
                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = "NS"; //Namespace
                                query['resource_Level3'] = resourceType; //Configmap
                                query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;

                            }

                            API_MSG = JSON.parse(mergedQuery);

                            break;

                        case "00000000000000000000000000002002":  //2002, for K8s ingress
                            resourceType = "IG";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Namespace'] = result.items[i].metadata.namespace;
                                query['resource_Status'] = result.items[i].status; //object
                                query['resource_Ingress_Class'] = result.items[i].spec.ingressClassName;
                                query['resource_Ingress_Rules'] = result.items[i].spec.rules; //array
                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = "NS"; //Namespace
                                query['resource_Level3'] = resourceType; //Ingress
                                query['resource_Level4'] = resourceType; //for MetricOps
                                query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);

                            break;

                        case "00000000000000000000000000000012":  //12, for K8s PV

                            resourceType = "PV";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Pv_Storage'] = result.items[i].spec.capacity.storage;
                                query['resource_Pv_Claim_Ref'] = result.items[i].spec.claimRef; //object
                                query['resource_Pv_Storage_Class_Name'] = result.items[i].spec.storageClassName;
                                query['resource_Pv_Volume_Mode'] = result.items[i].spec.volumeMode;
                                query['resource_Status'] = result.items[i].status; //object
                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = resourceType;
                                query['resource_Level4'] = resourceType; //for MetricOps
                                query['resource_Level_Type'] = "KC";  //K8s-Cluster
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;

                            }

                            API_MSG = JSON.parse(mergedQuery);

                            break;

                        case "00000000000000000000000000003002":  //3002, for K8s storage class
                            resourceType = "SC";

                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Owner_References'] = result.items[i].metadata.ownerReferences ; //object
                                query['resource_Sc_Provisioner'] = result.items[i].provisioner;
                                query['resource_Sc_Reclaim_Policy'] = result.items[i].reclaimPolicy;
                                query['resource_Sc_Allow_Volume_Expansion'] = result.items[i].allowVolumeExpansion;
                                query['resource_Sc_Volume_Binding_Mode'] = result.items[i].volumeBindingMode;
                                query['resource_Status'] = result.items[i].status; //object
                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = resourceType;
                                query['resource_Level_Type'] = "KC";  //K8s-Cluster
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }

                            API_MSG = JSON.parse(mergedQuery);


                            break;

                        case "00000000000000000000000000000008":  // 8 for K8s events, EV
                            resourceType = "EV";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Namespace'] = result.items[i].metadata.namespace;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;

                                query['resource_event_involved_object_kind'] = result.items[i].involvedObject.kind;
                                query['resource_event_involved_object_name'] = result.items[i].involvedObject.name;
                                query['resource_event_involved_object_namespace'] = result.items[i].involvedObject.namespace;

                                query['resource_event_reason'] = result.items[i].reason;
                                query['resource_event_message'] = result.items[i].message;

                                query['resource_event_source_component'] = result.items[i].source.component;
                                query['resource_event_source_host'] = result.items[i].source.host;

                                query['resource_event_first_timestamp'] = result.items[i].firstTimestamp;
                                query['resource_event_last_timestamp'] = result.items[i].lastTimestamp;
                                query['resource_event_count'] = result.items[i].count;
                                query['resource_event_type'] = result.items[i].type;

                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = "NS"; //Namespace
                                query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);

                            break;

                        case "00000000000000000000000000005002":  // 5002, for K8s Job
                            resourceType = "JO";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Namespace'] = result.items[i].metadata.namespace;
                                query['resource_Status'] = result.items[i].status; //object
                                query['resource_Type'] = resourceType;    //JO
                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = "NS"; //Namespace
                                query['resource_Level3'] = resourceType; //JO
                                query['resource_Level4'] = "WL"; //Workload // MetricOps
                                query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);

                            break;

                        case "00000000000000000000000000005003":  // 5003, for K8s CronJob
                            resourceType = "CJ";
                            for (let i=0; i<itemLength; i++)
                            {
                                query['resource_Type'] = resourceType ;
                                query['resource_Spec'] = result.items[i].spec;
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.items[i].metadata.name ;
                                query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                                query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                                query['resource_Labels'] = result.items[i].metadata.labels ; //object
                                query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                                query['resource_Namespace'] = result.items[i].metadata.namespace;
                                query['resource_Status'] = result.items[i].status; //object
                                query['resource_Type'] = resourceType;    //CJ
                                query['resource_Level1'] = "K8"; //k8s
                                query['resource_Level2'] = "NS"; //Namespace
                                query['resource_Level3'] = resourceType; //Replicaset
                                query['resource_Level4'] = "WL"; //Workload
                                query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }
                            API_MSG = JSON.parse(mergedQuery);

                            break;

                        // case "HVLIST-TEMPLATE-UUID":  //TODO insert Openstack HV List template uuid
                        //     length = result.hypervisors.length
                        //     if (length == 0)
                        //     {
                        //         console.log("Message ignored, no instance for resource, from the msg, template uuid: " + template_uuid + ", cluster_uuid: " + cluster_uuid, ", service_uuid: ", service_uuid );
                        //         channel.ack(msg);
                        //         return;
                        //     }
                        //     resourceType = "HV";
                        //
                        //     for (let i=0; i<length; i++)
                        //     {
                        //         query['resource_Type'] = resourceType;
                        //         query['resource_Spec'] = result.hypervisors[i];
                        //         query['resource_Group_Uuid'] = cluster_uuid;
                        //         query['resource_Name'] = result.hypervisors[i].hypervisor_hostname;
                        //         query['resource_Target_Uuid'] = result.hypervisors[i].id;
                        //         query['resource_Pod_Phase'] = result.hypervisors[i].status;
                        //         query['resource_Level1'] = "OS"; //Openstack
                        //         query['resource_Level2'] = resourceType;
                        //         query['resource_Level_Type'] = "OX";  //Openstack-Cluster
                        //         query['resource_Rbac'] = true;
                        //         query['resource_Anomaly_Monitor'] = false;
                        //         query['resource_Active'] = true;
                        //         // query['resource_Status_Updated_At'] = new Date();
                        //
                        //         tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                        //         mergedQuery = tempQuery;
                        //     }
                        //
                        //     API_MSG = JSON.parse(mergedQuery);
                        //
                        // break;
                        //
                        // case "HV-TEMPLATE-UUID":  //TODO insert Openstack PM template uuid
                        //     resourceType = "HV";
                        //
                        //     query['resource_Type'] = resourceType ;
                        //     query['resource_Spec'] = result.hypervisor;
                        //     query['resource_Group_Uuid'] = cluster_uuid ;
                        //     query['resource_Name'] = result.hypervisor.hypervisor_hostname ;
                        //     query['resource_Instance'] = result.hypervisor.host_ip ; // TODO: set host ip
                        //     query['resource_Target_Uuid'] = result.hypervisor.id ; // TODO: set Host uuid?
                        //     query['resource_Pod_Phase'] = result.hypervisor.status; // TODO: set instance status
                        //     query['resource_Level1'] = "OS"; //Openstack
                        //     query['resource_Level2'] = resourceType;
                        //     query['resource_Level_Type'] = "OX";  //Openstack-Cluster
                        //     query['resource_Rbac'] = true;
                        //     query['resource_Anomaly_Monitor'] = false;
                        //     query['resource_Active'] = true;
                        //
                        //     tempQuery = formatter_resource(i, length, resourceType, cluster_uuid, query, mergedQuery);
                        //     API_MSG = JSON.parse(tempQuery);
                        // case "PMLIST-TEMPLATE-UUID":  //TODO insert Openstack PM template uuid
                        //     length = result.projects.length
                        //     for (let i=0; i<length; i++)
                        //     {
                        //         query['resource_Type'] = resourceType ;
                        //         query['resource_Spec'] = result.items[i].spec;
                        //         query['resource_Group_Uuid'] = cluster_uuid ;
                        //         query['resource_Level1'] = "OS"; //Openstack
                        //         query['resource_Level2'] = resourceType;
                        //         query['resource_Level_Type'] = "OX";  //Openstack-Cluster
                        //         query['resource_Rbac'] = false;
                        //         query['resource_Anomaly_Monitor'] = false;
                        //         query['resource_Active'] = true;
                        //         // query['resource_Status_Updated_At'] = new Date();
                        //
                        //         tempQuery = formatter_resource(i, length, resourceType, cluster_uuid, query, mergedQuery);
                        //         mergedQuery = tempQuery;
                        //     }
                        //
                        //     API_MSG = JSON.parse(mergedQuery);
                        //
                        //     break;
                        case "50000000000000000000000000000002":  //TODO insert Openstack PJ List template uuid
                            length = result.projects.length

                            if (length === 0) {
                                console.log("Message ignored, no instance for resource, from the msg, template uuid: " + template_uuid + ", cluster_uuid: " + cluster_uuid, ", service_uuid: ", service_uuid );
                                channel.ack(msg);
                                return;
                            }
                            resourceType = "PJ";

                            for (let i=0; i<length; i++)
                            {
                                query['resource_Type'] = resourceType;
                                query['resource_Spec'] = result.projects[i];
                                query['resource_Group_Uuid'] = cluster_uuid ;
                                query['resource_Name'] = result.projects[i].name ;
                                query['resource_Description'] = result.projects[i].description;
                                query['resource_Target_Uuid'] = result.projects[i].id ;
                                query['resource_Target_Created_At'] = null
                                query['resource_Level1'] = "OS"; //Openstack
                                query['resource_Level2'] = resourceType;
                                query['resource_Level_Type'] = "OX";  //Openstack-Cluster
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                if (result.projects[i].enabled) {
                                    query['resource_Status'] = "true";
                                } else {
                                    query['resource_Status'] = "false";
                                }
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, length, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }

                            API_MSG = JSON.parse(mergedQuery);

                            break;

                        case "50000000000000000000000000000004":  //TODO insert Openstack VM List template uuid
                            length = result.servers.length
                            if (length === 0) {
                                console.log("Message ignored, no instance for resource, from the msg, template uuid: " + template_uuid + ", cluster_uuid: " + cluster_uuid, ", service_uuid: ", service_uuid );
                                channel.ack(msg);
                                return;
                            }
                            resourceType = "VM";

                            for (let i=0; i<length; i++)
                            {
                                query['resource_Type'] = resourceType;
                                query['resource_Spec'] = result.servers[i];
                                query['resource_Group_Uuid'] = cluster_uuid;
                                query['resource_Name'] = result.servers[i].name;
                                query['resource_Description'] = result.servers[i].description;
                                query['resource_Instance'] = result.servers[i].addresses;
                                query['resource_Target_Uuid'] = result.servers[i].id;
                                query['resource_Target_Created_At'] = result.servers[i].created;
                                query['resource_Namespace'] = result.servers[i].tenant_id;
                                query['parent_Resource_Id'] = result.servers[i]["OS-EXT-SRV-ATTR:host"];  //Openstack-Cluster
                                // query['resource_Status'] = result.servers[i].status;
                                query['resource_Level1'] = "OS"; // Openstack
                                query['resource_Level2'] = "PJ";
                                query['resource_Level3'] = resourceType;
                                query['resource_Level_Type'] = "OX";  //Openstack-Cluster
                                query['resource_Rbac'] = false;
                                query['resource_Anomaly_Monitor'] = false;
                                query['resource_Active'] = true;
                                query['resource_Status_Updated_At'] = new Date();

                                tempQuery = formatter_resource(i, length, resourceType, cluster_uuid, query, mergedQuery);
                                mergedQuery = tempQuery;
                            }

                            API_MSG = JSON.parse(mergedQuery);

                            break;
                        case "50000000000000000000000000000003":  //TODO insert Openstack VM template uuid
                            resourceType = "VM";

                            query['resource_Type'] = resourceType;
                            query['resource_Spec'] = result.server;
                            query['resource_Group_Uuid'] = cluster_uuid;
                            query['resource_Name'] = result.server.name;
                            query['resource_Description'] = result.server.description;
                            query['resource_Instance'] = result.server.addresses;
                            query['resource_Target_Uuid'] = result.server.id;
                            query['resource_Target_Created_At'] = result.server.created;
                            query['resource_Namespace'] = result.server.tenant_id;
                            query['parent_Resource_Id'] = result.server["OS-EXT-SRV-ATTR:host"];  //Openstack-Cluster
                            // query['resource_Status'] = result.server.status;
                            query['resource_Level1'] = "OS"; // Openstack
                            query['resource_Level2'] = "PJ";
                            query['resource_Level3'] = resourceType;
                            query['resource_Level_Type'] = "OX";  //Openstack-Cluster
                            query['resource_Rbac'] = false;
                            query['resource_Anomaly_Monitor'] = false;
                            query['resource_Active'] = true;
                            query['resource_Status_Updated_At'] = new Date();

                            tempQuery = formatter_resource(0, 0, resourceType, cluster_uuid, query, mergedQuery);

                            API_MSG = JSON.parse(tempQuery);
                            break;

                        default:
                    } //end of switch
                    result = "";
                    if (template_uuid === "00000000000000000000000000000008")
                    {
                        await callAPI(aggregatorResourceUrl, API_MSG)
                            .then
                            (
                                (response) => {
                                    channel.ack(msg);
                                    console.log("MQ message acknowleged:" + resourceType + ",cluster_uuid:" + cluster_uuid + ", " + RABBITMQ_SERVER_QUEUE_RESOURCE );
                                },
                                (error) => {
                                    console.log("MQ message un-acknowleged: " + RABBITMQ_SERVER_QUEUE_RESOURCE + ", cluster_uuid: " + cluster_uuid);
                                    //throw error;
                                }).catch
                        (
                            (error)=> {
                                console.log("MQ message un-acknowleged2: " + RABBITMQ_SERVER_QUEUE_RESOURCE + ", cluster_uuid: " + cluster_uuid);
                                //throw error;
                            }
                        )
                    } //end of resource_type = ev
                    else {
                        await callAPI(aggregatorResourceUrl, API_MSG)
                            .then
                            (
                                (response) => {
                                    channel.ack(msg);
                                    console.log("MQ message acknowleged: " + resourceType + ", " + RABBITMQ_SERVER_QUEUE_RESOURCE + ", cluster_uuid: " + cluster_uuid );
                                },
                                (error) => {
                                    console.log("MQ message un-acknowleged: " + RABBITMQ_SERVER_QUEUE_RESOURCE + ", cluster_uuid: " + cluster_uuid);
                                    //throw error;
                                }).catch
                        (
                            (error)=> {
                                console.log("MQ message un-acknowleged2: " + RABBITMQ_SERVER_QUEUE_RESOURCE + ", cluster_uuid: " + cluster_uuid);
                                //throw error;
                            }
                        )
                    } // end of resource_type - non ev
                }
                else {
                    channel.ack(msg);
                    console.log("Message ignored " + RABBITMQ_SERVER_QUEUE_RESOURCE + ", status code: " + status + ", cluster_uuid: " + cluster_uuid + ", service_uuid: " + service_uuid);
                }
            } catch (err) {
                console.log(err);
                channel.nack(msg, false, false);
            }

        })

        await channel.consume(RABBITMQ_SERVER_QUEUE_ALERT, async (msg) => {
            try {
                result = JSON.parse(msg.content.toString('utf-8'));
                const cluster_uuid = result.cluster_uuid;
                let service_uuid = result.service_uuid;

                if (result.status != 4) {
                    //console.log("Msg processed, nothing to update, status code: " + result.status + ", " + RABBITMQ_SERVER_QUEUE_ALERT + ", cluster_uuid: " + cluster_uuid + " service_uuid: " + service_uuid  );
                    channel.ack(msg);
                    //console.log (result);
                }
                else {
                    console.log("calling alert interface API : " + RABBITMQ_SERVER_QUEUE_ALERT + ", cluster_uuid: " + cluster_uuid );
                    await callAPI(API_ALERT_URL, result, "alerts", cluster_uuid)
                        .then
                        (
                            (response) => {
                                channel.ack(msg);
                                console.log("MQ message acknowleged: " + RABBITMQ_SERVER_QUEUE_ALERT + ", cluster_uuid: " + cluster_uuid );
                            },
                            (error) => {
                                console.log("MQ message un-acknowleged: ",RABBITMQ_SERVER_QUEUE_ALERT + ", cluster_uuid: " + cluster_uuid);
                                console.log(error);
                            })
                };
            } catch (error) {
                console.log(error)
                channel.nack(msg, false, false);
            }
            await callAPI(aggregatorAlertUrl, totalMsg)
            channel.ack(msg);
        }); // end of msg consume

        await channel.consume(RABBITMQ_SERVER_QUEUE_METRIC, async (msg) => {
            let totalMsg = JSON.parse(msg.content.toString('utf-8'));
            if (totalMsg.status !== 4) {
                console.log("Message ignored, No result in the message in resource channel metric meta");
                channel.ack(msg);
                return
            }

            await callAPI(aggregatorMetricMetaUrl, totalMsg)
            channel.ack(msg);
        }); // end of msg consume

        await channel.consume(RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED, async (msg) => {
            let totalMsg = JSON.parse(msg.content.toString('utf-8'));
            if (totalMsg.status !== 4) {
                console.log("Message ignored, No result in the message in resource channel alert");
                channel.ack(msg);
                return
                //console.log (result);
            }
            await callAPI(aggregatorMetricReceivedUrl, totalMsg)
            channel.ack(msg);
        });

        await channel.consume(RABBITMQ_SERVER_QUEUE_RESOURCE_OPS, async (msg) => {
            try {
                let totalMsg = JSON.parse(msg.content.toString('utf-8'));
                if (totalMsg.status !== 4) {
                    console.log("Message ignored, No result in the message in resource channel alert");
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
        console.log("API called: ", apiURL, " ", responseStatus);
      },
      (error) => {
        console.log("API error due to unexpoected error: ", apiURL, " ", error);
      })
}

app.listen(MQCOMM_PORT, () => console.log("NexClipper MQCOMM Server running at port " + MQCOMM_PORT));
