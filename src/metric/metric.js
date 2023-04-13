import axios from "axios";
import {getQueryDataMultipleForServerVPC} from "./ncp/server/server.js";

export async function getMetricQuery(totalMsg, clusterUuid) {
    let queryResult = {};
    switch (totalMsg.template_uuid) {
        case "queryMultipleDataForServer":
            queryResult = await getQueryDataMultipleForServerVPC(totalMsg, clusterUuid)
            break;
    }

    return queryResult;
}
// async function massUploadMetricReceived(metricReceivedMassFeed, clusterUuid) {
//
//     try {
//         let receivedData = metricReceivedMassFeed.result;
//         const clusterUuid = metricReceivedMassFeed.cluster_uuid;
//         const name = metricReceivedMassFeed.service_name;
//         metricReceivedMassFeed = null;
//         let receivedMetrics = receivedData.result;
//         receivedData = null;
//         const message_size_mb = (Buffer.byteLength(JSON.stringify(receivedMetrics)))/1024/1024;
//         console.log (`2. metric received name: ${name}, message size: ${message_size_mb}` );
//
//         if (message_size_mb>5){
//             const half = Math.ceil(receivedMetrics.length/2);
//             const firstHalf = receivedMetrics.slice(0, half);
//             const secondHalf = receivedMetrics.slice(-half);
//             let newResultMap1 = [];
//             firstHalf.map((data)=>{
//                 const{metric, value} = data;
//                 newResultMap1.push(JSON.stringify({metric, values: [parseFloat(value[1])], timestamps:[value[0]*1000]}))
//             });
//             let finalResult1 = (newResultMap1).join("\n")
//             newResultMap1 = null;
//             let massFeedResult1 = await callVM(finalResult1, clusterUuid);
//             if (!massFeedResult1 || (massFeedResult1?.status !== 204)) {
//                 // console.log("Data Issue1 -----------------", finalResult1);
//             }
//
//             console.log(`3-1. massFeedResult 1/2: ${massFeedResult1?.status}, clusterUuid: ${clusterUuid}, name: ${name}`);
//             finalResult1=null;
//             massFeedResult1= null;
//
//             let newResultMap2 = [];
//             secondHalf.map((data)=>{
//                 const{metric, value} = data;
//                 newResultMap2.push(JSON.stringify({metric, values: [parseFloat(value[1])], timestamps:[value[0]*1000]}))
//             });
//             let finalResult2 = (newResultMap2).join("\n")
//             newResultMap2= null;
//             let massFeedResult2 = await callVM(finalResult2, clusterUuid);
//             if (!massFeedResult2 || (massFeedResult2?.status !== 204)) {
//                 // console.log("Data Issue2 -----------------", finalResult2);
//             }
//
//             console.log(`3-2, massFeedResult 2/2: ${massFeedResult2?.status}, clusterUuid: ${clusterUuid}, name: ${name}`);
//             finalResult2=null;
//             massFeedResult2= null;
//         }
//         else {
//             let newResultMap = [];
//             receivedMetrics.map((data)=>{
//                 const{metric, value} = data;
//                 newResultMap.push(JSON.stringify({metric, values: [parseFloat(value[1])], timestamps:[value[0]*1000]}))
//             });
//             let finalResult = (newResultMap).join("\n")
//             newResultMap = null;
//             let massFeedResult = await callVM(finalResult, clusterUuid);
//             console.log(`3. massFeedResult: ${massFeedResult?.status}, clusterUuid: ${clusterUuid}, name: ${name}`);
//             if (!massFeedResult || (massFeedResult?.status !== 204)) {
//                 // console.log("Data Issue -----------------", finalResult);
//             }
//
//             finalResult = null;
//             massFeedResult= null;
//         } //end of else
//
//         receivedMetrics = null
//     } catch (error) {
//         console.log (`error on metricReceived - clusterUuid: ${clusterUuid}`, error);
//         throw error;
//     }
// }

// async function callVM (metricReceivedMassFeed, clusterUuid) {
//     const apiUrl = process.env.API_SERVER_RESOURCE_URL || "http://olly-dev-api.claion.io";
//     const apiPort = process.env.API_SERVER_RESOURCE_PORT || 5001;
//     const apiCustomerAccountGetPath =process.env.API_NAME_CUSTOMER_ACCOUNT_GET || "/customerAccount/resourceGroup";
//     const apiCustomerAccountGetUrl = apiUrl+":"+apiPort + apiCustomerAccountGetPath;
//     const vmUrl = process.env.VM_URL || 'http://olly-dev-vm.claion.io:8428/api/v1/import?extra_label=clusterUuid=';
//     const vmMultiUrl = process.env.VM_MULTI_AUTH_URL || 'http://olly-dev-vmauth.claion.io:8427/api/v1/import?extra_label=clusterUuid=';
//     const vmOption = process.env.VM_OPTION || "MULTI"; //BOTH - both / SINGLE - single-tenant / MULTI - multi-tenant
// //just for local
// //     const apiCustomerAccountGetUrl = apiUrl+ apiCustomerAccountGetPath;
//
//     let result;
//     if (vmOption === "SINGLE") {
//         const url = vmUrl + clusterUuid;
//         console.log (`2-1, calling vm interface: ${url}`);
//         try {
//             result = await axios.post (url, metricReceivedMassFeed, {maxContentLength:Infinity, maxBodyLength: Infinity})
//             console.log("VM-single inserted:", result.status)
//         } catch (error){
//             console.log("error on calling vm api");
//             //throw error;
//         }
//     } else if (vmOption === "MULTI") {
//         const urlCa = apiCustomerAccountGetUrl + "/" + clusterUuid;
//         let password;
//         let username;
//         try {
//             const customerAccount = await axios.get (urlCa)
//             username = 'I'+customerAccount.data.data.customerAccountId;
//             password = customerAccount.data.data.customerAccountId;
//         } catch (error){
//             console.log("error on confirming cluster information for metric feed");
//             throw error;
//         }
//         const urlMulti = vmMultiUrl + clusterUuid;
//         try {
//             result = await axios.post (urlMulti, metricReceivedMassFeed, {maxContentLength:Infinity, maxBodyLength: Infinity, auth:{username: username, password: password}})
//         } catch (error){
//             console.log("error on calling vm api");
//             throw error;
//         }
//     } else { // BOTH
//         const url = vmUrl + clusterUuid;
//         console.log (`2-1, calling vm interface: ${url}`);
//         try {
//             result = await axios.post (url, metricReceivedMassFeed, {maxContentLength:Infinity, maxBodyLength: Infinity})
//             console.log("VM-single inserted:", result.status)
//         } catch (error){
//
//             console.log("error on calling vm api", error);
//             console.log(metricReceivedMassFeed);
//             throw error;
//         }
//         const urlCa = apiCustomerAccountGetUrl + "/" + clusterUuid;
//         let password;
//         let username;
//         try {
//             const customerAccount = await axios.get (urlCa);
//             username = 'I' + customerAccount.data.data.customerAccountId;
//             password = customerAccount.data.data.customerAccountId;
//         } catch (error){
//             console.log("error on confirming cluster information for metric feed");
//             throw error;
//         }
//         const urlMulti = vmMultiUrl + clusterUuid;
//         console.log (`2-2, calling vm multi - interface: ${urlMulti}`);
//         try {
//             result = await axios.post (urlMulti, metricReceivedMassFeed, {maxContentLength:Infinity, maxBodyLength: Infinity, auth:{username: username, password: password}})
//             console.log("VM-multi inserted:", result.status)
//         } catch (error){
//             console.log("error on calling vm api");
//             throw error;
//         }
//     }
//
//     metricReceivedMassFeed = null
//     return result;
// }

