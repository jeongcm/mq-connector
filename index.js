const dontenv = require('dotenv');
dontenv.config();
const amqp = require("amqplib");
const axios = require('axios');
const express = require("express");

const app = express();
app.use(express.json());

const MQCOMMM_PORT = process.env.MQCOMMM_PORT || 4001;
const RABBITMQ_SERVER_URL = process.env.RABBITMQ_SERVER_URL || "amqp://localhost";
const RABBITMQ_SERVER_PORT = process.env.RABBITMQ_SERVER_PORT || 5672;
const RABBITMQ_SERVER_QUEUE_RESOURCE = process.env.RABBITMQ_SERVER_QUEUE_RESOURCE || "lari_resource";
const RABBITMQ_SERVER_QUEUE_ALERT = process.env.RABBITMQ_SERVER_QUEUE_ALERT || "lari_resource";
const RABBITMQ_SERVER_QUEUE_METRIC = process.env.RABBITMQ_SERVER_QUEUE_METRIC || "lari_metric";
const NODE_EXPORTER_PORT = process.env.NODE_EXPORTER_PORT || 9090;

const API_SERVER_RESOURCE_URL = process.env.API_SERVER_RESOURCE_URL || "http://localhost"
const API_SERVER_RESOURCE_PORT = process.env.API_SERVER_RESOURCE_PORT || "5001"
const API_NAME_RESOURCE_POST = process.env.API_NAME_RESOURCE_POST || "/resourceMass"
const API_SERVER_METRIC_URL = process.env.API_SERVER_METRIC_URL || "http://localhost"
const API_SERVER_METRIC_PORT = process.env.API_SERVER_METRIC_PORT || "5001"
const API_NAME_METRIC_POST = process.env.API_NAME_METRIC_POST || "/metricMass"
const API_SERVER_ALERT_URL = process.env.API_SERVER_ALERT_URL || "http://localhost"
const API_SERVER_ALERT_PORT = process.env.API_SERVER_ALERT_PORT || "5001"
const API_NAME_ALERT_POST = process.env.API_NAME_ALERT_POST || "/alertMass"
const RABBITMQ_SERVER_USER = process.env.RABBITMQ_SERVER_USER || "guest"
const RABBITMQ_SERVER_PASSWORD = process.env.RABBITMQ_SERVER_PASSWORD || "guest"
//const RABBITMQ_SERVER_VIRTUAL_HOST = process.env.RABBITMQ_SERVER_VIRTUAL_HOST || "nexclipper"
const RABBITMQ_SERVER_VIRTUAL_HOST = process.env.RABBITMQ_SERVER_VIRTUAL_HOST
const RabbitOpt = "amqp://" + RABBITMQ_SERVER_USER + ":" + RABBITMQ_SERVER_PASSWORD + "@";

var channel, connection;
const connect_string = RabbitOpt + RABBITMQ_SERVER_URL + ":" + RABBITMQ_SERVER_PORT + "/" + RABBITMQ_SERVER_VIRTUAL_HOST;
const API_RESOURCE_URL = API_SERVER_RESOURCE_URL+":"+API_SERVER_RESOURCE_PORT + API_NAME_RESOURCE_POST;
const API_METRIC_URL = API_SERVER_METRIC_URL+":"+API_SERVER_METRIC_PORT + API_NAME_METRIC_POST;
const API_ALERT_URL = API_SERVER_ALERT_URL+":"+API_SERVER_ALERT_PORT + API_NAME_ALERT_POST;

console.log(connect_string); 

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
            itemLength = result.items.length;

            var query = {};
            var mergedQuery = {};
            var tempQuery = {};
            var API_MSG = {};


            if (TotalMsg.status == 4) {
                switch (TotalMsg.template_uuid) {
                    case "00000000000000000000000000000020":  //20, for K8s services
                        var resourceType = "SV";
                        for (var i=0; i<itemLength; i++)
                        {
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

                            tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                            mergedQuery = tempQuery;     
                        }

                        API_MSG = JSON.parse(mergedQuery); 
                        console.log(API_MSG);
                 
                break;

                case "00000000000000000000000000000010":  //10, for K8s nodes
                    var resourceType = "ND";
                    for (var i=0; i<itemLength; i++)
                    {
                        // get internal IP address from addresses array and assign to InternalIP variable.
                        internalIpLength = result.items[i].status.addresses.length
                        for (var j=0; j<internalIpLength; j++)
                        {
                            if (result.items[i].status.addresses[j].type = 'InternalIP')
                            { 
                                internalIp = result.items[i].status.addresses[j].address;
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

                        tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 

                    }

                    API_MSG = JSON.parse(mergedQuery); 
                    console.log(API_MSG);
             
                break;

                case "00000000000000000000000000000004":  //04, for K8s namespaces
                    var resourceType = "NS";
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

                        tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 
                    console.log(API_MSG);

                break;

                case "00000000000000000000000000000002":  //02, for K8s pods
                    var resourceType = "PD";
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

                        tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 

                    }

                    API_MSG = JSON.parse(mergedQuery); 
                    console.log(API_MSG);

                break;

                case "00000000000000000000000000001002":  //1002, for K8s deployment
                    var resourceType = "DP";
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

                        tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 
                    console.log(API_MSG);


                break;

                case "00000000000000000000000000001004":  //1004, for K8s statefulset
                    var resourceType = "SS";
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

                        tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 
                    console.log(API_MSG);

                break;

                case "00000000000000000000000000001006":  //1006, for K8s daemonset
                    var resourceType = "DS";
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

                        tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 

                    }

                    API_MSG = JSON.parse(mergedQuery); 
                    console.log(API_MSG);


                break;

                case "00000000000000000000000000001008":  //1008, for K8s replicaset

                    var resourceType = "RS";
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

                        tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 
                    console.log(API_MSG);

                    break;

                case "00000000000000000000000000000018":  //18, for K8s pvc

                    var resourceType = "PC";
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

                        tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 
                    console.log(API_MSG);


                break;

                case "00000000000000000000000000000014":  //14, for K8s secret
                    var resourceType = "SE";
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

                        tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 
                    console.log(API_MSG);


                break;

                case "00000000000000000000000000000016":  //16, for K8s endpoint
                    var resourceType = "EP";
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

                        tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 
                    console.log(API_MSG);

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

                        tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 
                    console.log(API_MSG);

                break;

                case "00000000000000000000000000002002":  //2002, for K8s ingress
                    var resourceType = "IG";
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

                        tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 
                    console.log(API_MSG);

                break;

                case "00000000000000000000000000000012":  //12, for K8s PV

                    var resourceType = "PV";    
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

                        tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                        mergedQuery = tempQuery; 
    
                    }

                    API_MSG = JSON.parse(mergedQuery); 
                    console.log(API_MSG);

                break;

                case "00000000000000000000000000003002":  //3002, for K8s storage class
                    var resourceType = "SC";
                    
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

                            tempQuery = formater(i, itemLength, resourceType, TotalMsg.cluster_uuid, query, mergedQuery);
                            mergedQuery = tempQuery; 
                        }

                        API_MSG = JSON.parse(mergedQuery); 
                        console.log(API_MSG);

                break;

                case "0000000000000000000000000000xxxx":  //xxxx, for K8s Job, JO will be implemented once Sudory template is ready

                break;

                case "0000000000000000000000000000yyyy":  //yyyy, for K8s cron-job CJ will be implemented once Sudory template is ready

                break;

                default:        
                } //end of switch        

                callAPI(API_RESOURCE_URL, API_MSG );
                channel.ack(msg);
                console.log("Data sent : ",RABBITMQ_SERVER_QUEUE_RESOURCE);
        
            }
            else {
                channel.ack(msg);
                console.log("Message ignored");

            }      

        })

        channel.consume(RABBITMQ_SERVER_QUEUE_ALERT, (msg) => {
            result = JSON.parse(msg.content.toString());
            if (result.status == 4) {  //status=4 means Sudory client successfully sends the result back to Sudory server
                API_MSG = {"cluster_uuid": result.cluster_uuid,
                          "result": result.result, 
                         };
                callAPI(API_ALERT_URL, API_MSG );
            }
            channel.ack(data);
            console.log("Data sent : ",RABBITMQ_SERVER_QUEUE_ALERT, API_MSG);
            
        })

        channel.consume(RABBITMQ_SERVER_QUEUE_METRIC, (msg) => {
            result = JSON.parse(msg.content.toString());
            if (result.status == 4) {
                API_MSG = {"cluster_uuid": result.cluster_uuid,
                          "result": result.result, 
                          };
                callAPI(API_METRIC_URL, API_MSG );
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
        const status = response.data.message;
        console.log("API called: ", status);
      },
      (error) => {
        console.log("error due to unexpoected error: ", error.response);
      })

}


function formater(i, itemLength, resourceType, cluster_uuid, query, mergedQuery) {

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


app.listen(MQCOMMM_PORT, () => console.log("Server running at port " + MQCOMMM_PORT));