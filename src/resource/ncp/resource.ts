

function getResourceQuery(result, clusterUuid) {
    let resourceType;
    let query = {};
    let mergedQuery;
    let tempQuery = {};
    let resultLength = 0

    switch (result.templateUuid) {
    case "70000000000000000000000000000001":
        resourceType = "RG";
        resultLength = result.getRegionListResponse?.regionList?.length
        for (let i = 0; i < resultLength; i ++) {
            query['resource_Type'] = resourceType;
            query['resource_Spec'] = result.regionList;
            query['resource_Group_Uuid'] = clusterUuid;
            query['resource_Name'] = result.regionList.regionName;
            query['resource_Description'] = "";
            // query['resource_Instance'] = result.servers[i].addresses;
            query['resource_Target_Uuid'] = "";
            query['resource_Target_Created_At'] = new Date();
            // query['resource_Namespace'] = result.servers[i].tenant_id;
            // query['parent_Resource_Id'] = result.servers[i]["OS-EXT-SRV-ATTR:host"];  //Openstack-Cluster
            // query['resource_Status'] = result.servers[i].status;
            query['resource_Level1'] = "NCP"; // Openstack
            query['resource_Level2'] = resourceType;
            // query['resource_Level3'] = "";
            query['resource_Level_Type'] = "NX";  //Openstack-Cluster
            query['resource_Rbac'] = false;
            query['resource_Anomaly_Monitor'] = false;
            query['resource_Active'] = true;
            query['resource_Status_Updated_At'] = new Date();

            tempQuery = formatter_resource(i, length, resourceType, clusterUuid, query, mergedQuery);
            mergedQuery = tempQuery;
        }
    }

    return { message: JSON.parse(mergedQuery), resourceType: resourceType };
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