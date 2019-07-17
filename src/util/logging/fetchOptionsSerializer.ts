import {Serializer} from "bunyan";


/**
 * Serializer for bunyan logger that will explicitly remove body from fetchOptions prior to logging.
 *
 * @param fetchOptions
 */
export const fetchOptionsSerializer:Serializer = (options:any) => {
    if(!options){
        return;
    }
    const loggedObject = Object.assign({},options) ;

    if(!process.env.LOG_FETCH_BODY && options.body){
        loggedObject.body = 'REDACTED';

    }
    return loggedObject;
};