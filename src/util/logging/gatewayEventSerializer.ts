import {APIGatewayProxyEvent} from "aws-lambda";
import {Serializer} from "bunyan";


/**
 * Serializer for bunyan logger that will explicitly remove body from APIGatewauProxyEvent prior to logging.
 *
 * @param snsMessage
 */
export const gatewayEventSerializer:Serializer = (event:APIGatewayProxyEvent) => {
    if(!event){
        return;
    }
    const loggedObject = Object.assign({},event) ;


    if(!process.env.LOG_API_EVENT_BODY && event.body){
        loggedObject.body = 'REDACTED';

    }
    return loggedObject;
};