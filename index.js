//require('log-timestamp')
const dontenv = require('dotenv');
dontenv.config();
const amqp = require("amqplib");
const axios = require('axios');
const express = require("express");

require( 'console-stamp' )( console, {
    format: '(console).yellow :date().green.underline :label(7)'
  } );

const app = express();
app.use(express.json());

const MQCOMMM_PORT = process.env.MQCOMMM_PORT || 4001;
const NODE_EXPORTER_PORT = process.env.NODE_EXPORTER_PORT || 9100 ;

const RABBITMQ_SERVER_URL = process.env.RABBITMQ_SERVER_URL || "amqp://localhost";
const RABBITMQ_SERVER_PORT = process.env.RABBITMQ_SERVER_PORT || 5672;
const RABBITMQ_SERVER_QUEUE_RESOURCE = process.env.RABBITMQ_SERVER_QUEUE_RESOURCE || "nc_resource";
const RABBITMQ_SERVER_QUEUE_ALERT = process.env.RABBITMQ_SERVER_QUEUE_ALERT || "nc_alert";
const RABBITMQ_SERVER_QUEUE_METRIC = process.env.RABBITMQ_SERVER_QUEUE_METRIC || "nc_metric";
const RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED = process.env.RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED || "nc_metric_received";

const API_SERVER_RESOURCE_URL = process.env.API_SERVER_RESOURCE_URL || "http://localhost"
const API_SERVER_RESOURCE_PORT = process.env.API_SERVER_RESOURCE_PORT || "5001"
const API_NAME_RESOURCE_POST = process.env.API_NAME_RESOURCE_POST || "/resourceMass"

const API_SERVER_METRIC_URL = process.env.API_SERVER_METRIC_URL || "http://localhost"
const API_SERVER_METRIC_PORT = process.env.API_SERVER_METRIC_PORT || "5001"
const API_NAME_METRIC_POST = process.env.API_NAME_METRIC_POST || "/metricMetaMass"

const API_SERVER_METRIC_RECEIVED_URL = process.env.API_SERVER_METRIC_RECEIVED_URL || "http://localhost"
const API_SERVER_METRIC_RECEIVED_PORT = process.env.API_SERVER_METRIC_RECEIVED_PORT || "5001"
const API_NAME_METRIC_RECEIVED_POST = process.env.API_NAME_METRIC_RECEIVED_POST || "/metricReceivedMass"

const API_SERVER_ALERT_URL = process.env.API_SERVER_ALERT_URL || "http://localhost"
const API_SERVER_ALERT_PORT = process.env.API_SERVER_ALERT_PORT || "5001"
const API_NAME_ALERT_POST = process.env.API_NAME_ALERT_POST || "/alertMass"

const RABBITMQ_SERVER_USER = process.env.RABBITMQ_SERVER_USER || "nexclipper"
const RABBITMQ_SERVER_PASSWORD = process.env.RABBITMQ_SERVER_PASSWORD || "nexclipper"
const RABBITMQ_SERVER_VIRTUAL_HOST = process.env.RABBITMQ_SERVER_VIRTUAL_HOST || "nexclipper"
const RabbitOpt = "amqp://" + RABBITMQ_SERVER_USER + ":" + RABBITMQ_SERVER_PASSWORD + "@";

var channel, connection;
const connect_string = RabbitOpt + RABBITMQ_SERVER_URL + ":" + RABBITMQ_SERVER_PORT + "/" + RABBITMQ_SERVER_VIRTUAL_HOST;
const API_RESOURCE_URL = API_SERVER_RESOURCE_URL+":"+API_SERVER_RESOURCE_PORT + API_NAME_RESOURCE_POST;
const API_METRIC_URL = API_SERVER_METRIC_URL+":"+API_SERVER_METRIC_PORT + API_NAME_METRIC_POST;
const API_METRIC_RECEIVED_URL = API_SERVER_METRIC_RECEIVED_URL+":"+API_SERVER_METRIC_RECEIVED_PORT + API_NAME_METRIC_RECEIVED_POST;
const API_ALERT_URL = API_SERVER_ALERT_URL+":"+API_SERVER_ALERT_PORT + API_NAME_ALERT_POST;

 
var resourceType;

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
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED);

        channel.consume(RABBITMQ_SERVER_QUEUE_RESOURCE, (msg) => {
            var query = {};
            var mergedQuery = {};
            var tempQuery = {};
            var API_MSG = {};
            
            const TotalMsg = JSON.parse(msg.content.toString());
            const cluster_uuid =  TotalMsg.cluster_uuid;

            console.log("##########",TotalMsg);
            if (TotalMsg.status == 4) {
                const result = JSON.parse(TotalMsg.result);
                const itemLength = result.items.length;
                if (itemLength ==0) 
                    {
                        console.log("Message ignored, no instance from the msg" + RABBITMQ_SERVER_QUEUE_RESOURCE + ", cluster_uuid: " + cluster_uuid);
                        channel.ack(msg);
                        return;
                    }
                switch (TotalMsg.template_uuid) {
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
                            
                            query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                            query['resource_Name'] = result.items[i].metadata.name ;
                            query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                            query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                            query['resource_Labels'] = result.items[i].metadata.labels ; //object
                            query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                            query['resource_Namespace'] = result.items[i].metadata.namespace; 
                            query['resource_Instance'] = result.items[i].spec.clusterIP + ":" + resultPort;
                            query['resource_Status'] = result.items[i].status; //object
                            query['resource_Type'] = resourceType;
                            query['resource_Level1'] = "K8";
                            query['resource_Level2'] = "NS";
                            query['resource_Level3'] = resourceType;
                            query['resource_Level_Type'] = "KS";
                            query['resource_Rbac'] = true;
                            query['resource_Anomaly_Monitor'] = true;
                            query['resource_Active'] = true;
                            query['resource_Status_Updated_At'] = new Date();

                            tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
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
                            if (result.items[i].status.addresses[j].type = 'InternalIP')
                            { 
                                if (j==1) {
                                    internalIp = result.items[i].status.addresses[j].address;
                                }
                                //due to address type error, use 2nd order of address data for internal ip.
                            }
                        }
                        
                        query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                        query['resource_Name'] = result.items[i].metadata.name ;
                        query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                        query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                        query['resource_Labels'] = result.items[i].metadata.labels ; //object
                        query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                        query['resource_Instance'] = internalIp + ":" + NODE_EXPORTER_PORT;
                        query['resource_Status'] = result.items[i].status; //object
                        query['resource_Type'] = resourceType;
                        query['resource_Level1'] = "K8";
                        query['resource_Level2'] = resourceType;
                        query['resource_Level_Type'] = "KN";
                        query['resource_Rbac'] = true;
                        query['resource_Anomaly_Monitor'] = true;
                        query['resource_Active'] = true;
                        query['resource_Status_Updated_At'] = new Date();

                        tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
                    }

                    API_MSG = JSON.parse(mergedQuery); 

             
                break;

                case "00000000000000000000000000000004":  //04, for K8s namespaces
                    resourceType = "NS";
                    for (var i=0; i<itemLength; i++)
                    {
                        
                        query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                        query['resource_Name'] = result.items[i].metadata.name ;
                        query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                        query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                        query['resource_Labels'] = result.items[i].metadata.labels ; //object
                        query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                        query['resource_Status'] = result.items[i].status; //object
                        query['resource_Type'] = resourceType;
                        query['resource_Level1'] = "K8";
                        query['resource_Level2'] = resourceType;
                        //query['resource_Level3'] = "SV";
                        query['resource_Level_Type'] = "KS";
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = false;
                        query['resource_Active'] = true;
                        query['resource_Status_Updated_At'] = new Date();

                        tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 

                break;

                case "00000000000000000000000000000002":  //02, for K8s pods
                    resourceType = "PD";
                    for (var i=0; i<itemLength; i++)
                    {
                        query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                        query['resource_Name'] = result.items[i].metadata.name ;
                        query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                        query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                        query['resource_Labels'] = result.items[i].metadata.labels ; //object
                        query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                        query['resource_Namespace'] = result.items[i].metadata.namespace; 
                        query['resource_Instance'] = result.items[i].status.podIP;
                        query['resource_Pod_Phase'] = result.items[i].status.phase;
                        query['resource_Pod_Container'] = result.items[i].spec.containers; //array
                        query['resource_Status'] = result.items[i].status; //object
                        query['resource_Type'] = resourceType;
                        query['resource_Level1'] = "K8"; //k8s
                        query['resource_Level2'] = "ND"; //Node
                        query['resource_Level3'] = resourceType; //Pod
                        query['resource_Level_Type'] = "KN";  //K8s-Nodes-Pods
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = false;
                        query['resource_Active'] = true;
                        query['resource_Status_Updated_At'] = new Date();

                        tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 

                    }

                    API_MSG = JSON.parse(mergedQuery); 

                break;

                case "00000000000000000000000000001002":  //1002, for K8s deployment
                    resourceType = "DP";
                    for (var i=0; i<itemLength; i++)
                    {

                        query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                        query['resource_Name'] = result.items[i].metadata.name ;
                        query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                        query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                        query['resource_Labels'] = result.items[i].metadata.labels ; //object
                        query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                        query['resource_Namespace'] = result.items[i].metadata.namespace; 
                        query['resource_Match_Labels'] = result.items[i].spec.selector.matchLabels; //object
                        query['resource_Status'] = result.items[i].status; //object
                        query['resource_Type'] = resourceType;
                        query['resource_Level1'] = "K8"; //k8s
                        query['resource_Level2'] = "NS"; //Namespace
                        query['resource_Level3'] = resourceType; //Deployment
                        query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = false;
                        query['resource_Active'] = true;
                        query['resource_Status_Updated_At'] = new Date();

                        tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 

                break;

                case "00000000000000000000000000001004":  //1004, for K8s statefulset
                    resourceType = "SS";
                    for (var i=0; i<itemLength; i++)
                    {

                        query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                        query['resource_Name'] = result.items[i].metadata.name ;
                        query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                        query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                        query['resource_Labels'] = result.items[i].metadata.labels ; //object
                        query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                        query['resource_Namespace'] = result.items[i].metadata.namespace; 
                        query['resource_Sts_Replicas'] = result.items[i].spec.replicas; 
                        query['resource_Sts_Volume_Claim_Templates'] = result.items[i].spec.volumeClaimTemplates; //array
                        query['resource_Match_Labels'] = result.items[i].spec.selector.matchLabels;
                        query['resource_Status'] = result.items[i].status; //object
                        query['resource_Type'] = resourceType;    //Statefulset
                        query['resource_Level1'] = "K8"; //k8s
                        query['resource_Level2'] = "NS"; //Namespace
                        query['resource_Level3'] = resourceType; //Deployment
                        query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = false;
                        query['resource_Active'] = true;
                        query['resource_Status_Updated_At'] = new Date();

                        tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 
                   // console.log(API_MSG);

                break;

                case "00000000000000000000000000001006":  //1006, for K8s daemonset
                    resourceType = "DS";
                    for (var i=0; i<itemLength; i++)
                    {

                        query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                        query['resource_Name'] = result.items[i].metadata.name ;
                        query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                        query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                        query['resource_Labels'] = result.items[i].metadata.labels ; //object
                        query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                        query['resource_Namespace'] = result.items[i].metadata.namespace; 
                        query['resource_Match_Labels'] = result.items[i].spec.selector.matchLabels; //object
                        query['resource_Status'] = result.items[i].status; //object
                        query['resource_Type'] = resourceType;    //Daemonset
                        query['resource_Level1'] = "K8"; //k8s
                        query['resource_Level2'] = "NS"; //Namespace
                        query['resource_Level3'] = resourceType; //Deployment
                        query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = false;
                        query['resource_Active'] = true;
                        query['resource_Status_Updated_At'] = new Date();

                        tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 

                    }

                    API_MSG = JSON.parse(mergedQuery); 

                break;

                case "00000000000000000000000000001008":  //1008, for K8s replicaset

                    resourceType = "RS";
                    for (var i=0; i<itemLength; i++)
                    {

                        query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                        query['resource_Name'] = result.items[i].metadata.name ;
                        query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                        query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                        query['resource_Labels'] = result.items[i].metadata.labels ; //object
                        query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                        query['resource_Namespace'] = result.items[i].metadata.namespace;
                        query['resource_Replicas'] = result.items[i].spec.replicas;
                        query['resource_Match_Labels'] = result.items[i].spec.selector.matchLabels; //object
                        query['resource_Status'] = result.items[i].status; //object
                        query['resource_Type'] = resourceType;    //Replicaset
                        query['resource_Level1'] = "K8"; //k8s
                        query['resource_Level2'] = "NS"; //Namespace
                        query['resource_Level3'] = resourceType; //Replicaset
                        query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = false;
                        query['resource_Active'] = true;
                        query['resource_Status_Updated_At'] = new Date();

                        tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 


                    break;

                case "00000000000000000000000000000018":  //18, for K8s pvc

                    resourceType = "PC";
                    for (var i=0; i<itemLength; i++)
                    {

                        query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                        query['resource_Name'] = result.items[i].metadata.name ;
                        query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                        query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                        query['resource_Labels'] = result.items[i].metadata.labels ; //object
                        query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                        query['resource_Namespace'] = result.items[i].metadata.namespace;
                        query['resource_Pvc_Storage'] = result.items[i].spec.resources; //object
                        query['resource_Pvc_Volume_Name'] = result.items[i].spec.volumeName;
                        query['resource_Pvc_Storage_Class_Name'] = result.items[i].spec.storageClassName;
                        query['resource_Pvc_Volume_Mode'] = result.items[i].spec.volumeMode;
                        query['resource_Status'] = result.items[i].status; //object
                        query['resource_Type'] = resourceType;    //Persistent Volume Claim
                        query['resource_Level1'] = "K8"; //k8s
                        query['resource_Level2'] = "NS"; //Namespace
                        query['resource_Level3'] = resourceType; //Persistent Volume Claim
                        query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = false;
                        query['resource_Active'] = true;
                        query['resource_Status_Updated_At'] = new Date();

                        tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery;
                    }

                    API_MSG = JSON.parse(mergedQuery); 

                break;

                case "00000000000000000000000000000014":  //14, for K8s secret
                    resourceType = "SE";
                    for (var i=0; i<itemLength; i++)
                    {

                        query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                        query['resource_Name'] = result.items[i].metadata.name ;
                        query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                        query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                        query['resource_Labels'] = result.items[i].metadata.labels ; //object
                        query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                        query['resource_Namespace'] = result.items[i].metadata.namespace;
                        query['resource_Type'] = resourceType;    //Secret
                        query['resource_Level1'] = "K8"; //k8s
                        query['resource_Level2'] = "NS"; //Namespace
                        query['resource_Level3'] = resourceType; //Secert
                        query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = false;
                        query['resource_Active'] = true;
                        query['resource_Status_Updated_At'] = new Date();

                        tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
                    }

                    API_MSG = JSON.parse(mergedQuery); 

                break;

                case "00000000000000000000000000000016":  //16, for K8s endpoint
                    resourceType = "EP";
                    for (var i=0; i<itemLength; i++)
                    {

                        query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                        query['resource_Name'] = result.items[i].metadata.name ;
                        query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                        query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                        query['resource_Labels'] = result.items[i].metadata.labels ; //object
                        query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                        query['resource_Namespace'] = result.items[i].metadata.namespace;
                        query['resource_Endpoint'] = result.items[i].subsets; //array
                        query['resource_Type'] = resourceType;    //Endpoint
                        query['resource_Level1'] = "K8"; //k8s
                        query['resource_Level2'] = "NS"; //Namespace
                        query['resource_Level3'] = resourceType; //Endpoint
                        query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = false;
                        query['resource_Active'] = true;
                        query['resource_Status_Updated_At'] = new Date();

                        tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 


                break;

                case "00000000000000000000000000000006":  //06, for K8s configmap
                    var resourceType = "CM";
                    for (var i=0; i<itemLength; i++)
                    {

                        query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                        query['resource_Name'] = result.items[i].metadata.name ;
                        query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                        query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                        query['resource_Labels'] = result.items[i].metadata.labels ; //object
                        query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                        query['resource_Namespace'] = result.items[i].metadata.namespace;
                        query['resource_Configmap_Data'] = result.items[i].data; //object
                        query['resource_Type'] = resourceType;    //Configmap
                        query['resource_Level1'] = "K8"; //k8s
                        query['resource_Level2'] = "NS"; //Namespace
                        query['resource_Level3'] = resourceType; //Configmap
                        query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = false;
                        query['resource_Active'] = true;
                        query['resource_Status_Updated_At'] = new Date();

                        tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 

                break;

                case "00000000000000000000000000002002":  //2002, for K8s ingress
                    console.log("ingres...."); 
                    for (var i=0; i<itemLength; i++)
                    {
                        query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                        query['resource_Name'] = result.items[i].metadata.name ;
                        query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                        query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                        query['resource_Labels'] = result.items[i].metadata.labels ; //object
                        query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                        query['resource_Namespace'] = result.items[i].metadata.namespace;
                        query['resource_Status'] = result.items[i].status; //object
                        query['resource_Ingress_Class'] = result.items[i].spec.ingressClassName; 
                        query['resource_Ingress_Rules'] = result.items[i].spec.rules; //array
                        query['resource_Type'] = resourceType;    //Ingress
                        query['resource_Level1'] = "K8"; //k8s
                        query['resource_Level2'] = "NS"; //Namespace
                        query['resource_Level3'] = resourceType; //Ingress
                        query['resource_Level_Type'] = "KS";  //K8s-Namespaces-Services
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = false;
                        query['resource_Active'] = true;
                        query['resource_Status_Updated_At'] = new Date();

                        console.log(query);

                        tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        console.log(tempQuery); 
                        mergedQuery = tempQuery; 
    
                    }
                    
                    API_MSG = JSON.parse(mergedQuery); 

                break;

                case "00000000000000000000000000000012":  //12, for K8s PV

                    resourceType = "PV";    
                    console.log("PV...."); 
                    for (var i=0; i<itemLength; i++)
                    {
                        query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                        query['resource_Name'] = result.items[i].metadata.name ;
                        query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                        query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                        query['resource_Labels'] = result.items[i].metadata.labels ; //object
                        query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                        query['resource_Pv_Storage'] = result.items[i].spec.capacity.storage; 
                        query['resource_Pv_Claim_Ref'] = result.items[i].spec.claimRef; //object
                        query['resource_Pv_Storage_Class_Name'] = result.items[i].spec.storageClassName;
                        query['resource_Pv_Volume_Mode'] = result.items[i].spec.volumeMode;
                        query['resource_Status'] = result.items[i].status; //object
                        query['resource_Type'] = resourceType;    //PV'
                        query['resource_Level1'] = "K8"; //k8s
                        query['resource_Level2'] = resourceType;
                        query['resource_Level_Type'] = "KC";  //K8s-Cluster
                        query['resource_Rbac'] = false;
                        query['resource_Anomaly_Monitor'] = false;
                        query['resource_Active'] = true;
                        query['resource_Status_Updated_At'] = new Date();

                        tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        console.log(tempQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 

                break;

                case "00000000000000000000000000003002":  //3002, for K8s storage class
                    resourceType = "SC";
                    
                    for (var i=0; i<itemLength; i++)
                        {
                            query['resource_Group_Uuid'] = TotalMsg.cluster_uuid ;  
                            query['resource_Name'] = result.items[i].metadata.name ;
                            query['resource_Target_Uuid'] = result.items[i].metadata.uid ;
                            query['resource_Target_Created_At'] = result.items[i].metadata.creationTimestamp ;
                            query['resource_Labels'] = result.items[i].metadata.labels ; //object
                            query['resource_Annotations'] = result.items[i].metadata.annotations ; //object
                            query['resource_Sc_Provisioner'] = result.items[i].provisioner; 
                            query['resource_Sc_Reclaim_Policy'] = result.items[i].reclaimPolicy;
                            query['resource_Sc_Allow_Volume_Expansion'] = result.items[i].allowVolumeExpansion;
                            query['resource_Sc_Volume_Binding_Mode'] = result.items[i].volumeBindingMode;
                            query['resource_Status'] = result.items[i].status; //object
                            query['resource_Type'] = resourceType;    //PVC
                            query['resource_Level1'] = "K8"; //k8s
                            query['resource_Level2'] = resourceType;
                            query['resource_Level_Type'] = "KC";  //K8s-Cluster
                            query['resource_Rbac'] = false;
                            query['resource_Anomaly_Monitor'] = false;
                            query['resource_Active'] = true;
                            query['resource_Status_Updated_At'] = new Date();

                            tempQuery = formatter_resource(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                            mergedQuery = tempQuery; 
                        }

                        API_MSG = JSON.parse(mergedQuery); 


                break;

                case "0000000000000000000000000000xxxx":  //xxxx, for K8s Job, JO will be implemented once Sudory template is ready

                break;

                case "0000000000000000000000000000yyyy":  //yyyy, for K8s cron-job CJ will be implemented once Sudory template is ready

                break;

                default:        
                } //end of switch        
                callAPI(API_RESOURCE_URL, API_MSG, resourceType)
                .then
                (
                  (response) => {
                    channel.ack(msg);  
                    console.log("MQ message acknowleged: " + resourceType + ", " + RABBITMQ_SERVER_QUEUE_RESOURCE + ", cluster_uuid: " + cluster_uuid );
                      },
                  (error) => {
                    console.log("MQ message un-acknowleged: " + RABBITMQ_SERVER_QUEUE_RESOURCE + ", cluster_uuid: " + cluster_uuid);  
                    throw error;
                  }).catch 
                  (
                    (error)=> { 
                        console.log("unknown error");
                        throw error;
                    }
                  )
            }
            else {
                channel.ack(msg);
                console.log("Message ignored" + RABBITMQ_SERVER_QUEUE_RESOURCE + ", cluster_uuid: " + cluster_uuid);
            }
        })

        channel.consume(RABBITMQ_SERVER_QUEUE_ALERT, (msg) => {
            result = JSON.parse(msg.content.toString());
            const cluster_uuid = result.cluster_uuid;

            if (result.status != 4) {
                console.log("Msg processed, nothing to update : " + RABBITMQ_SERVER_QUEUE_ALERT + ", cluster_uuid: " + cluster_uuid );
                channel.ack(msg);
                }
            else {
                console.log("calling NC-CONNECT API : " + RABBITMQ_SERVER_QUEUE_ALERT + ", cluster_uuid: " + cluster_uuid );
                console.log(API_ALERT_URL);
                callAPI(API_ALERT_URL, result)
                .then
                (
                  (response) => {
                    channel.ack(msg);
                    console.log("MQ message acknowleged: " + RABBITMQ_SERVER_QUEUE_ALERT + ", cluster_uuid: " + cluster_uuid );
                      },
                  (error) => {
                    console.log("MQ message un-acknowleged: ",RABBITMQ_SERVER_QUEUE_ALERT + ", cluster_uuid: " + cluster_uuid);  
                    throw error;
                  })
                };
        }); // end of msg consume

        channel.consume(RABBITMQ_SERVER_QUEUE_METRIC, (msg) => {

            result = JSON.parse(msg.content.toString());
            const cluster_uuid = result.cluster_uuid;

            if (result.status != 4) {
                console.log("Msg processed, nothing to update : " + RABBITMQ_SERVER_QUEUE_METRIC + ", cluster_uuid: " + cluster_uuid );
                channel.ack(msg);
                }
            else {
                console.log("calling NC-CONNECT API : " + RABBITMQ_SERVER_QUEUE_METRIC + ", cluster_uuid: " + cluster_uuid );
                console.log(API_METRIC_URL);
                callAPI(API_METRIC_URL, result)
                .then
                (
                  (response) => {
                    channel.ack(msg);
                    console.log("MQ message acknowleged: " + RABBITMQ_SERVER_QUEUE_METRIC + ", cluster_uuid: " + cluster_uuid );
                      },
                  (error) => {
                    console.log("MQ message un-acknowleged: ",RABBITMQ_SERVER_QUEUE_METRIC + ", cluster_uuid: " + cluster_uuid);  
                    throw error;
                  })
                };
        }); // end of msg consume

        channel.consume(RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED, (msg) => {

            result = JSON.parse(msg.content.toString());
            const cluster_uuid = result.cluster_uuid;

            if (result.status != 4) {
                console.log("Msg processed, nothing to update : " + RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED + ", cluster_uuid: " + cluster_uuid );
                channel.ack(msg);
                }
            else {
                console.log("calling NC-CONNECT API : " + RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED + ", cluster_uuid: " + cluster_uuid );
                console.log(API_METRIC_RECEIVED_URL);
                callAPI(API_METRIC_RECEIVED_URL, result)
                .then
                (
                  (response) => {
                    channel.ack(msg);
                    console.log("MQ message acknowleged: " + RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED + ", cluster_uuid: " + cluster_uuid );
                      },
                  (error) => {
                    console.log("MQ message un-acknowleged: ",RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED + ", cluster_uuid: " + cluster_uuid);  
                    //throw error;
                  })
                }; 
        }); // end of msg consume
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function callAPI(apiURL,apiMsg, resourceType) {
   
    await axios.post(apiURL,apiMsg)
    .then
    (
      (response) => {
        const responseStatus = "status code: " + response.status;
        console.log("API called: ", resourceType, " ", apiURL, " ", responseStatus);
      },
      (error) => {
        const errorStatus = "status code:  " + error.status;  
        console.log("API error due to unexpoected error: ", apiURL, errorStatus);
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

app.listen(MQCOMMM_PORT, () => console.log("NexClipper MQCOMM Server running at port " + MQCOMMM_PORT));