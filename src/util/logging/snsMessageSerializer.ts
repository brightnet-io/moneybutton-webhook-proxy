import {Serializer} from "bunyan";


/**
 * Serializer for bunyan logger that will explicitly remove Message attribute from SNS Messages prior to logging.
 *
 * @param snsMessage
 */
export const snsMessageSerializer:Serializer = (snsMessage:any) => {
    if(!snsMessage){
        return;
    }
    const loggedObject = Object.assign({},snsMessage) ;

    if(!process.env.LOG_SNS_MESSAGE_BODY && loggedObject.Message){
        loggedObject.Message = 'REDACTED';

    }
    return loggedObject;
};