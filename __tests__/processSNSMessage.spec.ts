import createEvent from 'aws-event-mocks';
import {APIGatewayEvent, APIGatewayProxyEvent} from 'aws-lambda';
import context from 'aws-lambda-mock-context';
import {middyHandler} from '../src/functions/processSNSMessage';



// tslint:disable-next-line:no-var-requires
const fetch = require('node-fetch');

const mockValidateMessage = jest.fn().mockImplementation((message, callback) => {
    callback(null, message);
});

jest.mock('sns-validator', () => {
    return jest.fn().mockImplementation(() => ({
        validate: mockValidateMessage,
    }));
});


beforeEach(() => {
     fetch.resetMocks();
    jest.clearAllMocks();
    process.env.TOPIC_ARN = 'mock-topic-arn';
});

describe('Process SNS Message Handler Unit Tests', () => {
    describe('Request validation tests', () => {
        test('Rejects messages without sns message type header', (done) => {
            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'x-amz-sns-topic-arn': process.env.TOPIC_ARN,
                    },
                    body: JSON.stringify({}),
                },

            }) as APIGatewayEvent;

            middyHandler(evt, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(400);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    expect(jsonBody).toEqual(expect.objectContaining({
                        errors: expect.arrayContaining([
                            expect.objectContaining({
                                'status': 400,
                                'message': 'Invalid Headers',
                            }),
                        ]),
                    }));
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        test('Rejects messages with invalid message type', (done) => {
            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'x-amz-sns-message-type': 'IAmATeapot',
                        'x-amz-sns-topic-arn': process.env.TOPIC_ARN,
                        'User-Agent': 'Amazon Simple Notification Service Agent',
                    },
                    body: JSON.stringify({}),
                },

            }) as APIGatewayEvent;

            middyHandler(evt, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(400);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    expect(jsonBody).toEqual(expect.objectContaining({
                        errors: expect.arrayContaining([
                            expect.objectContaining({
                                'status': 400,
                                'message': 'Unknown message type',
                            }),
                        ]),
                    }));
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        test('Rejects messages with topic arn header that does not match arn from stack deployment', (done) =>{
            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'x-amz-sns-message-type': 'Notification',
                        'x-amz-sns-topic-arn':'no-match',
                    },
                    body: JSON.stringify({}),
                },

            }) as APIGatewayEvent;

            middyHandler(evt, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(400);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    expect(jsonBody).toEqual(expect.objectContaining({
                        errors: expect.arrayContaining([
                            expect.objectContaining({
                                'status': 400,
                                'message': 'Invalid Headers',
                            }),
                        ]),
                    }));
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
        test('Verifies the SNS message and returns error response if validate has error', (done) => {
            mockValidateMessage.mockImplementationOnce((message, callback) => callback(new Error('An Error')));
            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'x-amz-sns-message-type': 'IAmATeapot',
                        'x-amz-sns-topic-arn': process.env.TOPIC_ARN,
                        'User-Agent': 'Amazon Simple Notification Service Agent',
                    },
                    body: JSON.stringify({}),
                },

            }) as APIGatewayEvent;

            middyHandler(evt, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(mockValidateMessage).toBeCalledTimes(1);
                    expect(res!.statusCode).toBe(400);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    expect(jsonBody).toEqual(expect.objectContaining({
                        errors: expect.arrayContaining([
                            expect.objectContaining({
                                'status': 400,
                                'message': 'SNS Message failed verification',
                            }),
                        ]),
                    }));
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    describe('Subscription confirmation tests', () => {
        test('Returns a non-retryable error response if SubscribeURL is missing', (done) => {
            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'x-amz-sns-message-type': 'SubscriptionConfirmation',
                        'x-amz-sns-topic-arn': process.env.TOPIC_ARN,
                        'User-Agent': 'Amazon Simple Notification Service Agent',
                    },
                    body: JSON.stringify({}),
                },

            }) as APIGatewayEvent;

            middyHandler(evt, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(400);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    expect(jsonBody).toEqual(expect.objectContaining({
                        errors: expect.arrayContaining([
                            expect.objectContaining({
                                'status': 400,
                                'message': 'No Subscribe URL',
                            }),
                        ]),
                    }));
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
        test('Returns a  retryable error response if confirmation fetch throws error', (done) => {
            // It should return an error response with status code 500 if confirmation fails for some reason
            // 4xx response codes will result in the SubscribtionConfirmation message not being retried

            fetch.mockReject(new Error('fake error'));
            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'x-amz-sns-message-type': 'SubscriptionConfirmation',
                        'x-amz-sns-topic-arn': process.env.TOPIC_ARN,
                        'User-Agent': 'Amazon Simple Notification Service Agent',
                    },
                    body: JSON.stringify({
                        Type:'SubscriptionConfirmation',
                        SubscribeURL: 'mock',
                    }),
                },
            }) as APIGatewayEvent;

            middyHandler(evt, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(500);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    expect(jsonBody).toEqual(expect.objectContaining({
                        errors: expect.arrayContaining([
                            expect.objectContaining({
                                'status': 500,
                                'message': 'Error when attempting to confirm subscription',
                            }),
                        ]),
                    }));
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        test('Returns a success response if confirmation succeeds', (done) => {


            fetch.mockResponse('Success',{status: 200});
            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'x-amz-sns-message-type': 'SubscriptionConfirmation',
                        'User-Agent': 'Amazon Simple Notification Service Agent',
                        'x-amz-sns-topic-arn': process.env.TOPIC_ARN,
                    },
                    body: JSON.stringify({
                        Type:'SubscriptionConfirmation',
                        SubscribeURL: 'mock',
                    }),
                },

            }) as APIGatewayEvent;

            middyHandler(evt, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(200);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    const expected = {
                        'message': 'Subscription confirmed.',

                    };
                    expect(jsonBody).toMatchObject(expected);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    describe('Process notification tests', () => {
        let ctx;
        let completeEvent;

        beforeEach(() => {
            process.env.TARGET_ENDPOINT = 'mockUrl';
            ctx = context();
            completeEvent = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'x-amz-sns-message-type': 'Notification',
                        'User-Agent': 'Amazon Simple Notification Service Agent',
                        'x-amz-sns-topic-arn': process.env.TOPIC_ARN,
                    },
                    body: JSON.stringify({
                        SubscribeURL: 'mock',
                        Type:'Notification',
                        Message: JSON.stringify({
                            buttonData: '{ \'something\': \'else\'}',
                        }),
                    }),
                },

            });
        });


        test('Returns a retryable error if target endpoint not configured', (done) => {
            delete process.env.TARGET_ENDPOINT;
            middyHandler(completeEvent, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(503);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    expect(jsonBody).toEqual(expect.objectContaining({
                        errors: expect.arrayContaining([
                            expect.objectContaining({
                                'status': 503,
                                'message': 'Target endpoint not configured',
                            }),
                        ]),
                    }));

                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        test('Returns a retryable error response if post failed', (done) => {
            fetch.mockResponse('Fail',{status:500});

            middyHandler(completeEvent, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(502);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    expect(jsonBody).toEqual(expect.objectContaining({
                        errors: expect.arrayContaining([
                            expect.objectContaining({
                                'status': 502,
                                'message': 'Error response from upstream',
                            }),
                        ]),
                    }));

                    done();
                } catch (err) {
                    done(err);
                }
            });
        });


        test('Returns a success response (200) if post succeeds', (done) => {
            fetch.mockResponse('Success',{status:200});

            middyHandler(completeEvent, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(200);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    const expected = {
                        'message': 'Delivered',

                    };
                    expect(jsonBody).toMatchObject(expected);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

});