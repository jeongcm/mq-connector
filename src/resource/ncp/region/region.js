import {formatter_resource} from "../resource.js";

export async function getRegionListQuery(result, clusterUuid) {
    let query = {};
    let mergedQuery = {};
    let tempQuery = {};

    let resourceType = "RG";
    let resultLength = result.getRegionListResponse?.regionList?.length
    for (let i = 0; i < resultLength; i ++) {
        query['resource_Type'] = resourceType;
        query['resource_Spec'] = result.getRegionListResponse?.regionList[i];
        query['resource_Group_Uuid'] = clusterUuid;
        query['resource_Name'] = result.getRegionListResponse?.regionList[i]?.regionName;
        query['resource_Description'] = "";
        // query['resource_Instance'] =
        query['resource_Target_Uuid'] = result.getRegionListResponse?.regionList[i]?.regionCode; // new generate target uuid
        query['resource_Target_Created_At'] = new Date();
        // query['resource_Namespace'] =
        // query['parent_Resource_Id'] =
        // query['resource_Status'] =
        query['resource_Level1'] = "NCP";
        query['resource_Level2'] = resourceType;
        // query['resource_Level3'] = "";
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