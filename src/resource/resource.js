import {v1}  from 'uuid';
import {getRegionListQuery} from "./ncp/region/region.js";

export async function getResourceQuery(totalMsg, clusterUuid) {
    let queryResult = {};
    let result = totalMsg.result
    switch (totalMsg.template_uuid) {
        case "70000000000000000000000000000001":
            queryResult = await getRegionListQuery(result, clusterUuid)
        break;
    }

    return queryResult;
}

export function formatter_resource(i, itemLength, resourceType, cluster_uuid, query, mergedQuery) {
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