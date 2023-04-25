import {formatter_resource} from "../../resource.js";

export async function getServerInstanceListQuery(result, clusterUuid) {
    let query = {};
    let mergedQuery = {};
    let tempQuery = {};

    let resourceType = "SVR";
    let resultLength = result.getServerInstanceListResponse?.serverInstanceList?.length
    for (let i = 0; i < resultLength; i ++) {
        query['resource_Type'] = resourceType;
        query['resource_Spec'] = result.getServerInstanceListResponse?.serverInstanceList[i];
        query['resource_Group_Uuid'] = clusterUuid;
        query['resource_Name'] = result.getServerInstanceListResponse?.serverInstanceList[i]?.serverName;
        query['resource_Description'] = result.getServerInstanceListResponse?.serverInstanceList[i]?.serverDescription;
        // query['resource_Instance'] =
        query['resource_Target_Uuid'] = result.getServerInstanceListResponse?.serverInstanceList[i]?.serverInstanceNo;
        query['resource_Target_Created_At'] = new Date();
        // query['resource_Namespace'] =
        // query['parent_Resource_Id'] =
        query['resource_Status'] = result.getServerInstanceListResponse?.serverInstanceList[i]?.serverInstanceStatus;
        query['resource_Level1'] = "NCP";
        query['resource_Level2'] = "VPC";
        query['resource_Level3'] = "SVR";
        query['resource_Level_Type'] = "NX";
        query['resource_Rbac'] = false;
        query['resource_Anomaly_Monitor'] = false;
        query['resource_Active'] = true;
        query['resource_Status_Updated_At'] = new Date();

        tempQuery = formatter_resource(i, resultLength, resourceType, clusterUuid, query, mergedQuery);
        mergedQuery = tempQuery;
    }

    return { message: mergedQuery, resourceType: resourceType }
}