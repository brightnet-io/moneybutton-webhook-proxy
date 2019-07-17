import {APIGatewayEvent, APIGatewayProxyHandler, Context, SNSMessage} from "aws-lambda";
import * as httpErrors from "http-errors";
import middy from "middy";
import {jsonErrorHandler} from "../middlewares/json-error-handler";
import {snsHeaderFixer} from "../middlewares/sns-header-fixer";
import {snsVerifier} from "../middlewares/sns-verifier";

import {httpErrorHandler, jsonBodyParser} from 'middy/middlewares';

import * as bunyan from "bunyan";
import * as fetch from "node-fetch";
import {Response} from "node-fetch";
import {fetchOptionsSerializer} from "../util/logging/fetchOptionsSerializer";
import {gatewayEventSerializer} from "../util/logging/gatewayEventSerializer";
import {snsMessageSerializer} from "../util/logging/snsMessageSerializer";



const log = bunyan.createLogger({
    name: 'processSNSMessage',
    serializers: {
        snsMessage: snsMessageSerializer,
        fetchOptions: fetchOptionsSerializer,
        gatewayEvent: gatewayEventSerializer,
    },
});

/**
 * Respond to a SubscriptionConfirmation SNS message by calling the SubscribeURL to confirm subscription
 * @param message SNS Message (event) body
 */
const confirmSubscription = async (message: any) => {
    if (!message.SubscribeURL) {
        log.error({snsMessage: message}, 'Missing SubscribeURL in message');
        throw new httpErrors.BadRequest('No Subscribe URL');
    }

    let response: Response;

    try {
        response = await fetch.default(message.SubscribeURL);
    } catch (error) {
        log.error({
            snsMessage: message,
            err: error,
        }, 'Error when attempting to confirm subscription');
        throw new httpErrors.InternalServerError('Error when attempting to confirm subscription');
    }
    if (response && response.ok) {
        log.info({topicArn: message.TopicArn}, 'Subscription confirmed to SNS Topic');
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Subscription confirmed.',
            }),
        };
    } else {
        log.error({
            snsMessage: message,
            response,
        }, 'Error response when attempting to confirm subscription');
        throw new httpErrors.InternalServerError('Failed to confirm subscription');
    }


};

const processNotification = async (message: SNSMessage) => {
    if (!process.env.TARGET_ENDPOINT || !process.env.TARGET_ENDPOINT.trim()) {
        log.error({targetEndpoint: process.env.TARGET_ENDPOINT}, 'Target endpoint not configured. Set function Environment Variable TARGET_ENDPOINT');
        throw new httpErrors.ServiceUnavailable('Target endpoint not configured');
    }

    const endpoint = process.env.TARGET_ENDPOINT;

    const fetchOptions = {
        method: 'post',
        body: message.Message,
        headers: {'Content-Type': 'application/json'},
        timeout: parseInt(process.env.REQUEST_TIMEOUT || '5000',10),
    };

    let response: Response;
    try {
        response = await fetch.default(endpoint, fetchOptions);
    } catch (error) {
        log.warn({
            snsMessage: message,
            targetEndpoint: endpoint,
            err: error,
            fetchOptions,
        }, 'Fetch error posting to target endpoint');
        throw new httpErrors.BadGateway('Error connecting to upstream')
    }

    if (response && response.ok) {
        log.info({
            topicArn: message.TopicArn,
            messageId: message.MessageId,
            messageTimestamp: message.Timestamp,
            targetEndpoint: endpoint,
            responseStatusCode: response.status,
            responseStatusText: response.statusText,
        }, 'Message successfully posted to target endpoint');
        return {
            body: JSON.stringify({
                message: 'Delivered',

            }),
            statusCode: 200,
        };
    } else {
        const fetchResponse ={
            statusCode: response.status,
            statusText: response.statusText,
             body: await response.text(),
        };
        log.warn({snsMessage:message,targetEndpoint:endpoint,fetchResponse,fetchOptions},'Error response posting message to target endpoint');
        throw new httpErrors.BadGateway('Error response from upstream');
    }


};

const handler: APIGatewayProxyHandler = async (event: APIGatewayEvent, context: Context) => {

    // Bail out if not an SNS message
    if (!event.headers['x-amz-sns-message-type']) {
        log.error({gatewayEvent:event},'Request does not contain x-amz-message-type header');
        throw new httpErrors.BadRequest('No Message type header');
    }

    const message: any = event.body;


    switch (event.headers['x-amz-sns-message-type']) {
        case 'Notification':
            return await processNotification(message);
        case 'SubscriptionConfirmation':
            return await confirmSubscription(message);
        default:
            log.warn({gatewayEvent:event},'Event contains unknown message type header');
            throw new httpErrors.BadRequest('Unknown message type');
    }


};

export const middyHandler = middy(handler)
    .use(snsVerifier())
    .use(snsHeaderFixer())
    // .use(contentTypeValidator())
    .use(jsonBodyParser())
    .use(jsonErrorHandler())
    .use(httpErrorHandler({logger: undefined}));

