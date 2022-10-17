const dontenv = require('dotenv');
dontenv.config();
const amqp = require("amqplib");
const axios = require('axios');
const express = require("express");
const MAX_API_BODY_SIZE = process.env.MAX_API_BODY_SIZE || "500mb"; 

require( 'console-stamp' )( console, {
    format: '(console).yellow :date().green.underline :label(7)'
  } );

const app = express();
app.use(express.json( {limit: MAX_API_BODY_SIZE} ));
app.use(express.urlencoded( {limit: MAX_API_BODY_SIZE} ));
app.get('/health', (req, res)=>{
    res.send ("health check passed");
});

const MQCOMM_PORT = process.env.MQCOMM_PORT || 4001;
//const MQCOMM_HEALTH_PORT = process.env.MQCOMM_HEALTH_PORT || 4012;
const NODE_EXPORTER_PORT = process.env.NODE_EXPORTER_PORT || 9100 ;
const RABBITMQ_PROTOCOL_HOST = process.env.RABBITMQ_PROTOCOL_HOST || "amqp://"
const RABBITMQ_SERVER_URL = process.env.RABBITMQ_SERVER_URL || "localhost";
const RABBITMQ_SERVER_PORT = process.env.RABBITMQ_SERVER_PORT || 5672;
const RABBITMQ_SERVER_QUEUE_RESOURCE = process.env.RABBITMQ_SERVER_QUEUE_RESOURCE || "nc_resource";
const RABBITMQ_SERVER_QUEUE_ALERT = process.env.RABBITMQ_SERVER_QUEUE_ALERT || "nc_alert";
const RABBITMQ_SERVER_QUEUE_METRIC = process.env.RABBITMQ_SERVER_QUEUE_METRIC || "nc_metric";
const RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED = process.env.RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED || "nc_metric_received";

const API_SERVER_RESOURCE_URL = process.env.API_SERVER_RESOURCE_URL || "http://localhost";
const API_SERVER_RESOURCE_PORT = process.env.API_SERVER_RESOURCE_PORT || "5001";
const API_NAME_RESOURCE_POST = process.env.API_NAME_RESOURCE_POST || "/resourceMass";
const API_NAME_CUSTOMER_ACCOUNT_GET =process.env.API_NAME_CUSTOMER_ACCOUNT_GET || "/customerAccount/resourceGroup";

const API_SERVER_RESOURCE_EVENT_URL = process.env.API_SERVER_RESOURCE_EVENT_URL || "http://localhost";
const API_SERVER_RESOURCE_EVENT_PORT = process.env.API_SERVER_RESOURCE_EVENT_PORT || "5001";
const API_NAME_RESOURCE_EVENT_POST = process.env.API_NAME_RESOURCE_EVENT_POST || "/resourceEventMass";

const API_SERVER_METRIC_URL = process.env.API_SERVER_METRIC_URL || "http://localhost";
const API_SERVER_METRIC_PORT = process.env.API_SERVER_METRIC_PORT || "5001";
const API_NAME_METRIC_POST = process.env.API_NAME_METRIC_POST || "/metricMetaMass";

//const API_SERVER_METRIC_RECEIVED_URL = process.env.API_SERVER_METRIC_RECEIVED_URL || "http://localhost";
//const API_SERVER_METRIC_RECEIVED_PORT = process.env.API_SERVER_METRIC_RECEIVED_PORT || "5001";
//const API_NAME_METRIC_RECEIVED_POST = process.env.API_NAME_METRIC_RECEIVED_POST || "/metricReceivedMass";

const API_SERVER_ALERT_URL = process.env.API_SERVER_ALERT_URL || "http://localhost";
const API_SERVER_ALERT_PORT = process.env.API_SERVER_ALERT_PORT || "5001";
const API_NAME_ALERT_POST = process.env.API_NAME_ALERT_POST || "/alertMass";

const RABBITMQ_SERVER_USER = process.env.RABBITMQ_SERVER_USER || "nexclipper";
const RABBITMQ_SERVER_PASSWORD = process.env.RABBITMQ_SERVER_PASSWORD || "nexclipper";
const RABBITMQ_SERVER_VIRTUAL_HOST = process.env.RABBITMQ_SERVER_VIRTUAL_HOST || "nexclipper";
const RabbitOpt = RABBITMQ_PROTOCOL_HOST + RABBITMQ_SERVER_USER + ":" + RABBITMQ_SERVER_PASSWORD + "@";

var channel, connection;
const connect_string = RabbitOpt + RABBITMQ_SERVER_URL + ":" + RABBITMQ_SERVER_PORT + "/" + RABBITMQ_SERVER_VIRTUAL_HOST;
const API_RESOURCE_URL = API_SERVER_RESOURCE_URL+":"+API_SERVER_RESOURCE_PORT + API_NAME_RESOURCE_POST;
const API_RESOURCE_EVENT_URL = API_SERVER_RESOURCE_EVENT_URL+":"+API_SERVER_RESOURCE_EVENT_PORT + API_NAME_RESOURCE_EVENT_POST;
const API_METRIC_URL = API_SERVER_METRIC_URL+":"+API_SERVER_METRIC_PORT + API_NAME_METRIC_POST;
//const API_METRIC_RECEIVED_URL = API_SERVER_METRIC_RECEIVED_URL+":"+API_SERVER_METRIC_RECEIVED_PORT + API_NAME_METRIC_RECEIVED_POST;
const API_CUSTOMER_ACCOUNT_GET_URL = API_SERVER_RESOURCE_URL+":"+API_SERVER_RESOURCE_PORT + API_NAME_CUSTOMER_ACCOUNT_GET;
const API_ALERT_URL = API_SERVER_ALERT_URL+":"+API_SERVER_ALERT_PORT + API_NAME_ALERT_POST;
//const MQCOMM_RESOURCE_TARGET_DB = process.env.MQCOMM_RESOURCE_TARGET_DB;
const vm_Url = process.env.VM_URL;
const VM_MULTI_AUTH_URL = process.env.VM_MULTI_AUTH_URL;
const VM_OPTION = process.env.VM_OPTION; //BOTH - both / SINGLE - single-tenant / MULTI - multi-tenant

process.stdin.resume();//so the program will not close instantly
function exitHandler(options, exitCode) {
    if (options.cleanup) console.log('clean');
    if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) process.exit();
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


connectQueue()

async function connectQueue() {
    try {
        var result = "";
        connection = await amqp.connect(connect_string);
        channel = await connection.createChannel();
        // connect to RABBITMQ_SERVER_QUEUE_NAME, create one if doesnot exist already
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_RESOURCE);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_ALERT);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC);
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED);
        await channel.consume(RABBITMQ_SERVER_QUEUE_RESOURCE, (msg) => {
            var resourceType;
            var query = {};
            var mergedQuery = {};
            var tempQuery = {};
            var API_MSG = {};
            let TotalMsg = JSON.parse(msg.content.toString('utf8'));
            const cluster_uuid =  TotalMsg.cluster_uuid;
            const template_uuid = TotalMsg.template_uuid;
            const service_uuid = TotalMsg.service_uuid;
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
                let result = TotalMsg.result;
                let length
                const itemLength = result.items.length;
                if (itemLength == 0) 
                    {
                        console.log("Message ignored, no instance for resource, from the msg, template uuid: " + template_uuid + ", cluster_uuid: " + cluster_uuid, ", service_uuid: ", service_uuid );
                        channel.ack(msg);
                        return;
                    }
                switch (template_uuid) {
                case "00000000000000000000000000000020":  //20, for K8s services
                        resourceType = "SV";
                        for (var i=0; i<itemLength; i++)
                        {
                            tempQuery = {};
                            // get port number from port array and assign to resultPort variable.
                            resultPortsLength = result.items[i].spec.ports.length
                            for (var j=0; j<resultPortsLength; j++)
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
                    for (var i=0; i<itemLength; i++)
                    {
                        // get internal IP address from addresses array and assign to InternalIP variable.
                        let internalIpLength = result.items[i].status.addresses.length
                        let internalIp = "";
                        for (var j=0; j<internalIpLength; j++)
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
                    for (var i=0; i<itemLength; i++)
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
                    for (var i=0; i<itemLength; i++)
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
                        query['resource_Level_Type'] = "KN";  //K8s-Nodes-Pods
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = true;
                        query['resource_Active'] = true;
                        query['resource_Status_Updated_At'] = new Date();

                        tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
                    }
                    API_MSG = JSON.parse(mergedQuery); 
                break;

                case "00000000000000000000000000001002":  //1002, for K8s deployment
                    resourceType = "DP";
                    for (var i=0; i<itemLength; i++)
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

                case "00000000000000000000000000001004":  //1004, for K8s statefulset
                    resourceType = "SS";
                    for (var i=0; i<itemLength; i++)
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
                        query['resource_Sts_Volume_Claim_Templates'] = result.items[i].spec.volumeClaimTemplates; //array
                        query['resource_Match_Labels'] = result.items[i].spec.selector.matchLabels;
                        query['resource_Status'] = result.items[i].status; //object
                        query['resource_Level1'] = "K8"; //k8s
                        query['resource_Level2'] = "NS"; //Namespace
                        query['resource_Level3'] = resourceType; //Deployment
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
                   // console.log(API_MSG);
                break;

                case "00000000000000000000000000001006":  //1006, for K8s daemonset
                    resourceType = "DS";
                    for (var i=0; i<itemLength; i++)
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

                case "00000000000000000000000000001008":  //1008, for K8s replicaset

                    resourceType = "RS";
                    for (var i=0; i<itemLength; i++)
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

                case "00000000000000000000000000000018":  //18, for K8s pvc

                    resourceType = "PC";
                    for (var i=0; i<itemLength; i++)
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
                    for (var i=0; i<itemLength; i++)
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
                    for (var i=0; i<itemLength; i++)
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
                    var resourceType = "CM";
                    for (var i=0; i<itemLength; i++)
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
                    var resourceType = "IG";
                    for (var i=0; i<itemLength; i++)
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
                    for (var i=0; i<itemLength; i++)
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
                    
                    for (var i=0; i<itemLength; i++)
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
                    for (var i=0; i<itemLength; i++)
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
                    for (var i=0; i<itemLength; i++)
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

                case "00000000000000000000000000005003":  // 5003, for K8s CronJob
                    resourceType = "CJ";
                    for (var i=0; i<itemLength; i++)
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
                //     for (var i=0; i<length; i++)
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
                //         query['resource_Rbac'] = false;
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
                //     query['resource_Rbac'] = false;
                //     query['resource_Anomaly_Monitor'] = false;
                //     query['resource_Active'] = true;
                //
                //     tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                //     API_MSG = JSON.parse(tempQuery);

                case "PJLIST-TEMPLATE-UUID":  //TODO insert Openstack PJ List template uuid
                    length = result.projects.length
                    if (length === 0)
                    {
                        console.log("Message ignored, no instance for resource, from the msg, template uuid: " + template_uuid + ", cluster_uuid: " + cluster_uuid, ", service_uuid: ", service_uuid );
                        channel.ack(msg);
                        return;
                    }
                    resourceType = "PJ";

                    for (var i=0; i<length; i++)
                    {
                        query['resource_Type'] = resourceType;
                        query['resource_Spec'] = result.projects[i];
                        query['resource_Group_Uuid'] = cluster_uuid ;
                        query['resource_Name'] = result.projects[i].name ;
                        query['resource_Description'] = result.projects[i].description;
                        query['resource_Target_Uuid'] = result.projects[i].id ;
                        query['resource_Level1'] = "OS"; //Openstack
                        query['resource_Level2'] = resourceType;
                        query['resource_Level_Type'] = "OX";  //Openstack-Cluster
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = false;
                        query['resource_Active'] = true;

                        tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery;
                    }

                    API_MSG = JSON.parse(mergedQuery);

                break;

                case "VMLIST-TEMPLATE-UUID":  //TODO insert Openstack VM List template uuid
                    length = result.servers.length
                    if (length === 0)
                    {
                        console.log("Message ignored, no instance for resource, from the msg, template uuid: " + template_uuid + ", cluster_uuid: " + cluster_uuid, ", service_uuid: ", service_uuid );
                        channel.ack(msg);
                        return;
                    }
                    resourceType = "VM";

                    for (var i=0; i<length; i++)
                    {
                        query['resource_Type'] = resourceType;
                        query['resource_Spec'] = result.servers[i];
                        query['resource_Group_Uuid'] = cluster_uuid;
                        query['resource_Name'] = result.servers[i].name;
                        query['resource_Target_Uuid'] = result.servers[i].id;
                        query['resource_Level1'] = "OS"; // Openstack
                        query['resource_Level2'] = "PJ";
                        query['resource_Level3'] = "PM";
                        query['resource_Level4'] = resourceType;
                        query['resource_Level_Type'] = "OX";  //Openstack-Cluster
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = false;
                        query['resource_Active'] = true;

                        tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery;
                    }

                    API_MSG = JSON.parse(mergedQuery);

                break;
                case "VM-TEMPLATE-UUID":  //TODO insert Openstack VM template uuid
                    resourceType = "VM";

                    query['resource_Type'] = resourceType;
                    query['resource_Spec'] = result.server;
                    query['resource_Group_Uuid'] = cluster_uuid;
                    query['resource_Name'] = result.server.name;
                    query['resource_Description'] = result.server.description;
                    query['resource_Instance'] = result.server.addresses;
                    query['resource_Target_Uuid'] = result.server.id;
                    query['resource_Namespace'] = result.server.tenant_id;
                    query['resource_Pod_Phase'] = result.server.status;
                    query['resource_Level1'] = "OS"; // Openstack
                    query['resource_Level2'] = "PJ";
                    query['resource_Level3'] = "PM";
                    query['resource_Level4'] = resourceType;
                    query['resource_Level_Type'] = "OX";  //Openstack-Cluster
                    query['resource_Rbac'] = false;
                    query['resource_Anomaly_Monitor'] = false;
                    query['resource_Active'] = true;

                    tempQuery = formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery);

                    API_MSG = JSON.parse(tempQuery);
                break;

                default:        
                } //end of switch
                result = "";
                if (template_uuid === "00000000000000000000000000000008")
                    {
                        callAPI(API_RESOURCE_EVENT_URL, API_MSG, resourceType, cluster_uuid)
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
                    console.log("------------------------------------------------------------------------")
                    console.log("API message: ", API_MSG)
                    console.log("------------------------------------------------------------------------")
                    callAPI(API_RESOURCE_URL, API_MSG, resourceType, cluster_uuid)
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
        })

        await channel.consume(RABBITMQ_SERVER_QUEUE_ALERT, (msg) => {
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
                callAPI(API_ALERT_URL, result, "alerts", cluster_uuid)
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
        }); // end of msg consume

        await channel.consume(RABBITMQ_SERVER_QUEUE_METRIC, (msg) => {
            result = JSON.parse(msg.content.toString('utf-8'));
            //result = msg.content.toString('utf-8');
            const cluster_uuid = result.cluster_uuid;
            let service_uuid = result.service_uuid;
            if (result.status != 4) {
                //console.log("Msg processed, nothing to update, status code: " + result.status + ", " + RABBITMQ_SERVER_QUEUE_METRIC + ", cluster_uuid: " + cluster_uuid  + " service_uuid: " + service_uuid);
                channel.ack(msg);
                //console.log (result);
                }
            else {
                console.log("calling metric meta interface API : " + RABBITMQ_SERVER_QUEUE_METRIC + ", cluster_uuid: " + cluster_uuid );
                //console.log (result);
                callAPI(API_METRIC_URL, result, "metric", cluster_uuid)
                .then
                (
                  (response) => {
                    channel.ack(msg);
                    console.log("MQ message acknowleged: " + RABBITMQ_SERVER_QUEUE_METRIC + ", cluster_uuid: " + cluster_uuid );
                      },
                  (error) => {
                    console.log("MQ message un-acknowleged: ",RABBITMQ_SERVER_QUEUE_METRIC + ", cluster_uuid: " + cluster_uuid);  
                    console.log(error);
                  })
                };
        }); // end of msg consume

        await channel.consume(RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED, (msg) => {
            result = JSON.parse(msg.content.toString('utf-8'));
            const rabbitmq_message_size = (Buffer.byteLength(msg.content.toString()))/1024/1024;
            const cluster_uuid = result.cluster_uuid;
            const service_uuid = result.service_uuid;
        
            if (result.status != 4) {
                //console.log("Msg processed, nothing to update, status code: " + result.status + ", " + RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED + ", cluster_uuid: " + cluster_uuid + " service_uuid: " + service_uuid);
                channel.ack(msg);
                //console.log (result);
                }
            else {
                const name = result.service_name;
                console.log("1. calling metric received mass upload API : " + RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED + ", cluster_uuid: " + cluster_uuid + " service_uuid: " + service_uuid + " rabbitmq_message_size(mb): " + rabbitmq_message_size + " service_name: " + name  );
                massUploadMetricReceived(result, cluster_uuid)
                .then
                (
                  (response) => {
                    channel.ack(msg);
                    result = "";                    
                    console.log("4. MQ message acknowleged: " + RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED + ", cluster_uuid: " + cluster_uuid + ", Msg Size (MB): " + rabbitmq_message_size + " service_name: " + name);  
                      },
                  (error) => {
                    channel.ack(msg);  
                    console.log("4. MQ message un-acknowleged: ",RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED + ", cluster_uuid: " + cluster_uuid + ", Msg Size (MB): " + rabbitmq_message_size + " service_name: " + name);  
                    result = "";
                    console.log(error);
                  })

                }; // end of else

        }); // end of msg consume
    } catch (error) {
        console.log ("error", error)
        throw error;
    }
}

async function callAPI(apiURL, apiMsg , resourceType, cluster_uuid) {
    axios.post(apiURL,apiMsg, {maxContentLength:Infinity, maxBodyLength: Infinity})
    .then
    (
      (response) => {
        const responseStatus = "status code: " + response.status;
        console.log("API called: ", resourceType, " ", cluster_uuid, " ", apiURL, " ", responseStatus);
      },
      (error) => {
        console.log("API error due to unexpoected error: ", resourceType, " ", cluster_uuid, " ", apiURL, " ", error);
      })
}

function formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery) {
    let interimQuery = {};
    try {
        if (itemLength==1) {
            interimQuery = '{"resource_Type": "' + resourceType + '", "resource_Group_Uuid": "' + cluster_uuid + '", ' + '"resource":[' + JSON.stringify(query) + "]}";
        }
        else {    
            if (i==0) {
                interimQuery = '{"resource_Type": "' + resourceType + '", "resource_Group_Uuid": "' + cluster_uuid + '", ' + '"resource":[' + JSON.stringify(query);
            }
            else if (i==(itemLength-1)) {
                interimQuery = mergedQuery + "," + JSON.stringify(query) + "]}";
            }
            else {
                interimQuery = mergedQuery +  "," + JSON.stringify(query);
            }
        }
    } catch (error) {
        console.log("error due to unexpoected error: ", error.response);
    }
    return interimQuery;
}


async function massUploadMetricReceived(metricReceivedMassFeed, clusterUuid){

    try {
        //let receivedData = JSON.parse(metricReceivedMassFeed.result);
        let receivedData = metricReceivedMassFeed.result;
        const clusterUuid = metricReceivedMassFeed.cluster_uuid;
        const name = metricReceivedMassFeed.service_name;
        metricReceivedMassFeed = null;
        let receivedMetrics = receivedData.result;
        receivedData = null;
        const message_size_mb = (Buffer.byteLength(JSON.stringify(receivedMetrics)))/1024/1024;
        console.log (`2. metric received name: ${name}, message size: ${message_size_mb}` );

        if (message_size_mb>5){
          const half = Math.ceil(receivedMetrics.length/2);
          const firstHalf = receivedMetrics.slice(0, half); 
          const secondHalf = receivedMetrics.slice(-half);  
          let newResultMap1 = [];
          firstHalf.map((data)=>{
            const{metric, value} = data;
            newResultMap1.push(JSON.stringify({metric, values: [parseFloat(value[1])], timestamps:[value[0]*1000]}))
          });
          let finalResult1 = (newResultMap1).join("\n")
          newResultMap1 = null;
          let massFeedResult1 = await callVM(finalResult1, clusterUuid);
          if (!massFeedResult1 || (massFeedResult1.status != 204)) {
            console.log("Data Issue1 -----------------", finalResult);
          }

          console.log(`3-1. massFeedResult 1/2: ${massFeedResult1.status}, clusterUuid: ${clusterUuid}, name: ${name}`); 
          finalResult1=null;
          massFeedResult1= null;
          let newResultMap2 = [];
          secondHalf.map((data)=>{
            const{metric, value} = data;
            newResultMap2.push(JSON.stringify({metric, values: [parseFloat(value[1])], timestamps:[value[0]*1000]}))
          });
          let finalResult2 = (newResultMap2).join("\n")
          newResultMap2= null;
          let massFeedResult2 = await callVM(finalResult2, clusterUuid);
          if (!massFeedResult2 || (massFeedResult2.status != 204)) {
            console.log("Data Issue2 -----------------", finalResult);
          }

          console.log(`3-2, massFeedResult 2/2: ${massFeedResult2.status}, clusterUuid: ${clusterUuid}, name: ${name}`); 
          finalResult2=null;
          massFeedResult2= null;      
        }
        else {
          let newResultMap = [];
          receivedMetrics.map((data)=>{
            const{metric, value} = data;
            newResultMap.push(JSON.stringify({metric, values: [parseFloat(value[1])], timestamps:[value[0]*1000]}))
          });
          let finalResult = (newResultMap).join("\n")
          newResultMap = null;
          let massFeedResult = await callVM(finalResult, clusterUuid);
          console.log(`3. massFeedResult: ${massFeedResult.status}, clusterUuid: ${clusterUuid}, name: ${name}`); 
          if (!massFeedResult || (massFeedResult.status != 204)) {
            console.log("Data Issue -----------------", finalResult);
          }
          finalResult = null;
          massFeedResult= null;
          } //end of else 
      } catch (error) {
        console.log (`error on metricRecieved - clusterUuid: ${clusterUuid}`, error);
        //throw error;
      }
}    

async function callVM (metricReceivedMassFeed, clusterUuid) {
    let result;
    if (VM_OPTION === "SINGLE") {
        const url = vm_Url + clusterUuid;
        console.log (`2-1, calling vm interface: ${url}`); 
        try {
            result = await axios.post (url, metricReceivedMassFeed, {maxContentLength:Infinity, maxBodyLength: Infinity})
            console.log("VM-single inserted:", result.status)
        } catch (error){
            console.log("error on calling vm api");
        //throw error;
        };
    } else if (VM_OPTION === "MULTI") {
        const urlCa = API_CUSTOMER_ACCOUNT_GET_URL + "/" + clusterUuid;
        let password;
        let username;
        try {
            const customerAccount = await axios.get (urlCa)
            username = 'I'+customerAccount.data.data.customerAccountId;
            password = customerAccount.data.data.customerAccountId;
          } catch (error){
            console.log("error on confirming cluster information for metric feed");
            throw error;
          };
        const urlMulti = VM_MULTI_AUTH_URL + clusterUuid;
        try {
            result = await axios.post (urlMulti, metricReceivedMassFeed, {maxContentLength:Infinity, maxBodyLength: Infinity, auth:{username: username, password: password}})
        } catch (error){
            console.log("error on calling vm api");
            throw error;
        };
    } else { // BOTH
        const url = vm_Url + clusterUuid;
        console.log (`2-1, calling vm interface: ${url}`); 
        try {
            result = await axios.post (url, metricReceivedMassFeed, {maxContentLength:Infinity, maxBodyLength: Infinity})
            console.log("VM-single inserted:", result.status)
        } catch (error){

        console.log("error on calling vm api", error);
        console.log(metricReceivedMassFeed);
        throw error;
        };
        const urlCa = API_CUSTOMER_ACCOUNT_GET_URL + "/" + clusterUuid;
        let password;
        let username;
        try {
            const customerAccount = await axios.get (urlCa);
            username = 'I' + customerAccount.data.data.customerAccountId;
            password = customerAccount.data.data.customerAccountId;
          } catch (error){
            console.log("error on confirming cluster information for metric feed");
            throw error;
          };
        const urlMulti = VM_MULTI_AUTH_URL + clusterUuid;
        console.log (`2-2, calling vm multi - interface: ${urlMulti}`); 
        try {
            result = await axios.post (urlMulti, metricReceivedMassFeed, {maxContentLength:Infinity, maxBodyLength: Infinity, auth:{username: username, password: password}})
            console.log("VM-multi inserted:", result.status)
        } catch (error){
            console.log("error on calling vm api");
            throw error;
        };
    }
    return result;
}

app.listen(MQCOMM_PORT, () => console.log("NexClipper MQCOMM Server running at port " + MQCOMM_PORT));
