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


const MQCOMM_PORT = process.env.MQCOMM_PORT || 4001;
//const MQCOMM_HEALTH_PORT = process.env.MQCOMM_HEALTH_PORT || 4012;
const NODE_EXPORTER_PORT = process.env.NODE_EXPORTER_PORT || 9100 ;
const RABBITMQ_PROTOCOL_HOST = process.env.RABBITMQ_PROTOCOL_HOST || "amqp://"
const RABBITMQ_SERVER_URL = process.env.RABBITMQ_SERVER_URL || "localhost";
const RABBITMQ_SERVER_PORT = process.env.RABBITMQ_SERVER_PORT || 5672;
const RABBITMQ_SERVER_QUEUE_RESOURCE = process.env.RABBITMQ_SERVER_QUEUE_RESOURCE || "co_resource";
const RABBITMQ_SERVER_QUEUE_ALERT = process.env.RABBITMQ_SERVER_QUEUE_ALERT || "co_alert";
const RABBITMQ_SERVER_QUEUE_METRIC = process.env.RABBITMQ_SERVER_QUEUE_METRIC || "co_metric";
const RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED = process.env.RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED || "co_metric_received";

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

const RABBITMQ_SERVER_USER = process.env.RABBITMQ_SERVER_USER || "claion";
const RABBITMQ_SERVER_PASSWORD = process.env.RABBITMQ_SERVER_PASSWORD || "claion";
const RABBITMQ_SERVER_VIRTUAL_HOST = process.env.RABBITMQ_SERVER_VIRTUAL_HOST || "claion";
const RabbitOpt = RABBITMQ_PROTOCOL_HOST + RABBITMQ_SERVER_USER + ":" + RABBITMQ_SERVER_PASSWORD + "@";

var channel, connection;
const connect_string = RabbitOpt + RABBITMQ_SERVER_URL + ":" + RABBITMQ_SERVER_PORT + "/" + RABBITMQ_SERVER_VIRTUAL_HOST + "?heartbeat=180";
const API_RESOURCE_URL = API_SERVER_RESOURCE_URL+":"+API_SERVER_RESOURCE_PORT + API_NAME_RESOURCE_POST;
const API_RESOURCE_EVENT_URL = API_SERVER_RESOURCE_EVENT_URL+":"+API_SERVER_RESOURCE_EVENT_PORT + API_NAME_RESOURCE_EVENT_POST;
const API_METRIC_URL = API_SERVER_METRIC_URL+":"+API_SERVER_METRIC_PORT + API_NAME_METRIC_POST;
//const API_METRIC_RECEIVED_URL = API_SERVER_METRIC_RECEIVED_URL+":"+API_SERVER_METRIC_RECEIVED_PORT + API_NAME_METRIC_RECEIVED_POST;
const API_CUSTOMER_ACCOUNT_GET_URL = API_SERVER_RESOURCE_URL+":"+API_SERVER_RESOURCE_PORT + API_NAME_CUSTOMER_ACCOUNT_GET;
const API_ALERT_URL = API_SERVER_ALERT_URL+":"+API_SERVER_ALERT_PORT + API_NAME_ALERT_POST;
//const MQCOMM_RESOURCE_TARGET_DB = process.env.MQCOMM_RESOURCE_TARGET_DB;
const vm_Url = process.env.VM_URL || 'http://olly-dev-vm.claion.io';
const VM_MULTI_AUTH_URL = process.env.VM_MULTI_AUTH_URL;
const VM_OPTION = process.env.VM_OPTION || "SINGLE"; //BOTH - both / SINGLE - single-tenant / MULTI - multi-tenant


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
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_METRIC);
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

        await channel.consume(RABBITMQ_SERVER_QUEUE_METRIC, (msg) => {
            let totalMsg = JSON.parse(msg.content.toString('utf-8'));
            if (totalMsg.status != 4) {
                console.log("Message ignored, No result in the message in resource channel metric");
                channel.ack(msg);
                return
            }

            callAPI(aggregatorMetricUrl, totalMsg.result)
        }); // end of msg consume

        await channel.consume(RABBITMQ_SERVER_QUEUE_METRIC_RECEIVED, (msg) => {
            let totalMsg = JSON.parse(msg.content.toString('utf-8'));
            if (totalMsg.status !== 4) {
                console.log("Message ignored, No result in the message in resource channel alert");
                channel.ack(msg);
                return
                //console.log (result);
            }
            callAPI(aggregatorMetricReceivedtUrl, totalMsg.result)
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
