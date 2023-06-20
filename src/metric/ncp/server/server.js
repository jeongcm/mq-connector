export async function getQueryDataMultipleForServerVPC(totalMsg, clusterUuid) {
    // initialize result
    let queryResult = {}
    queryResult.service_name = totalMsg.service_name
    queryResult.cluster_uuid = totalMsg.cluster_uuid
    queryResult.result = {}
    queryResult.result.result = []

    // get origin metric data
    const originResult = totalMsg.result

    originResult.forEach((orig) => {

    })

    let data = {
        metric: {},
        value: {}
    }




    return queryResult
}

async function massUploadNcpMetrics(ncpMetricResult, clusterUuid) {

    try {
        // 1. get response for ncp metric result
        // 2. make metric object by paylod in response data
        // 3. metric name have a prefix name ncp_XXX
        // 4. input vm with newResultMap
        let receivedData = JSON.parse(metricReceivedMassFeed.result);
        // let receivedData = ncpMetricResult.result;
        const clusterUuid = ncpMetricResult.cluster_uuid;
        const name = ncpMetricResult.service_name;
        ncpMetricResult = null;


        let receivedMetrics = receivedData.result;
        receivedData = null;
        console.log (`2. metric received name: ${name}` );

        let newResultMap = [];
        receivedMetrics.map((data)=>{
            const{metric, value} = data;
            newResultMap.push(JSON.stringify({metric, values: [parseFloat(value[1])], timestamps:[value[0]]}))
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
    } catch (error) {
        console.log (`error on metricRecieved - clusterUuid: ${clusterUuid}`, error);
        //throw error;
    }
}