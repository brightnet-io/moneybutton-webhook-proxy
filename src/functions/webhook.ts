import {APIGatewayEvent, APIGatewayProxyHandler, Context} from "aws-lambda";
import AWS from "aws-sdk";
import {ClientConfiguration} from "aws-sdk/clients/sns";
import * as bunyan from "bunyan";
import * as httpErrors from "http-errors";
import middy from "middy";
import {contentTypeValidator} from "../middlewares/content-type-validator";
import {jsonErrorHandler} from "../middlewares/json-error-handler";

import {httpErrorHandler, jsonBodyParser, validator} from 'middy/middlewares';

import {gatewayEventSerializer} from "../util/logging/gatewayEventSerializer";

const log = bunyan.createLogger({
    name: 'webhook',
    serializers: {
        gatewayEvent: gatewayEventSerializer,
    },
});

const mbWebhookPayloadValidationSchema = {
    required: ['body'],
    properties: {
        body: {
            type: 'object',
            properties: {
                secret: {type: 'string'},
                payment: {type: 'object'},
            },
            required: ['secret', 'payment'],
        },
    },

};


const handler: APIGatewayProxyHandler = async (event:any, context: Context) => {

    if(process.env.WEBHOOK_SECRET && (process.env.WEBHOOK_SECRET !== event.body.secret)) {
        log.warn({providedSecret: event.body.secret},'Invalid secret in payload');
        throw new httpErrors.Forbidden('Wrong');
    }
    const snsOptions: ClientConfiguration = {
        apiVersion: '2010-03-31',
    };

    if (process.env.IS_OFFLINE) {
        snsOptions.endpoint = "http://127.0.0.1:4002";
    }

    const sns = new AWS.SNS(snsOptions);

    const input = {
        Message: JSON.stringify(event.body),
        TopicArn: process.env.TOPIC_ARN,
    };

    try {
        await sns.publish(input).promise();
        log.info({topicArn: input.TopicArn},'Webhook request published to SNS Topic');
        return {
            body: JSON.stringify({
                message: 'Update event accepted.',

            }),
            statusCode: 202,
        };
    } catch (err) {
        log.warn({err},'Error publishing to SNS topic');
        throw new httpErrors.InternalServerError('Message not queued.');
    }


};

export const handle = middy(handler)
    .use(contentTypeValidator())
    .use(jsonBodyParser())
    .use(validator({inputSchema: mbWebhookPayloadValidationSchema}))
    .use(jsonErrorHandler())
    .use(httpErrorHandler({logger: undefined}));
