
import {Middleware} from "middy";


export const snsHeaderFixer: Middleware<undefined, any, any> = () => {



    return ({
        before: (handler, next) => {
            const {headers} = handler.event;
            if(headers && headers['x-amz-sns-message-type'] &&  'Amazon Simple Notification Service Agent' === headers['User-Agent']){
                headers['Content-Type'] = 'application/json'
            }

            next();
        },

    });


};

