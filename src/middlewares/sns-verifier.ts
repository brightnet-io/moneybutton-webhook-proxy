
import * as httpErrors from "http-errors";
import {Middleware} from "middy";
import MessageValidator from "sns-validator";

export const snsVerifier: Middleware<undefined, any, any> = () => {



    return ({
        before: (handler, next) => {
            const {headers} = handler.event;
            if(!headers || !headers['x-amz-sns-message-type'] || !headers['x-amz-sns-topic-arn'] || headers['x-amz-sns-topic-arn'] !== process.env.TOPIC_ARN ){
                throw new httpErrors.BadRequest('Invalid Headers');
            } else {
               const validator = new MessageValidator();
               validator.validate(handler.event.body, (err,message)=>{
                   if(err){
                     throw new httpErrors.BadRequest('SNS Message failed verification');
                   } else {
                       next();
                   }
               });
            }

        },

    });


};

