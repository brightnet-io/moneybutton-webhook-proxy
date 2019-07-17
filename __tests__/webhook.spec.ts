import createEvent from "aws-event-mocks";
import {APIGatewayEvent} from "aws-lambda";
import context from "aws-lambda-mock-context";
import * as AWSMock from "aws-sdk-mock";
import * as Sinon from "sinon";
import {handle} from "../src/functions/webhook";

beforeEach((done)=>{
    done();
});
afterEach(async (done) => {
    delete process.env.WEBHOOK_SECRET;
    AWSMock.restore();
    done();
});

describe("Webhook Handler Unit Tests", () => {
    describe("Content Type validation Tests", () => {
        test("Reject requests that have no content-type header", (done) => {
            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',

            });

            handle(evt, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(400);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    const expected = {
                        errors: [
                            {
                                "status": 400,
                                "message": "Endpoint requires Content-Type header value application/json",
                            },
                        ],
                    };
                    expect(jsonBody).toMatchObject(expected);
                    done();
                } catch (err) {
                    done(err);
                }
            });


        });


        test("Reject requests that do not have Content-Type application/json header", (done) => {
            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'Content-Type': 'text/css',
                    },
                },
            });

            handle(evt, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(400);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    const expected = {
                        errors: [
                            {
                                "status": 400,
                                "message": "Endpoint requires Content-Type header value application/json",
                            },
                        ],
                    };
                    expect(jsonBody).toMatchObject(expected);
                    done();
                } catch (err) {
                    done(err);
                }
            });


        });

        test("Reject requests with JSON syntax errors", (done) => {
            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: 'This is not json',
                },
            });
            handle(evt, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(422);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    const expected = {
                        "errors": [
                            {
                                "status": 422,
                                "message": "Content type defined as JSON but an invalid JSON was provided",
                            },
                        ],
                    };
                    expect(jsonBody).toMatchObject(expected);
                    done();
                } catch (err) {
                    done(err);
                }
            });

        });


    });

    describe("Payload Structure validation tests", () => {
        test("Reject requests missing secret", (done) => {
            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        payment: {},
                    }),
                },
            });
            handle(evt, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(400);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    const expected = {
                        "errors": [
                            {
                                "status": 400,
                                "message": "Event object failed validation",
                                "detail": [
                                    {
                                        "keyword": "required",
                                        "dataPath": ".body",
                                        "schemaPath": "#/properties/body/required",
                                        "params": {
                                            "missingProperty": "secret",
                                        },
                                        "message": "should have required property secret",
                                    },
                                ],
                            },
                        ],
                    };
                    expect(jsonBody).toMatchObject(expected);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        test("Reject requests missing payment", (done) => {
            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        secret: 'secret',
                    }),
                },
            });
            handle(evt, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(400);
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    const expected = {
                        "errors": [
                            {
                                "status": 400,
                                "message": "Event object failed validation",
                                "detail": [
                                    {
                                        "keyword": "required",
                                        "dataPath": ".body",
                                        "schemaPath": "#/properties/body/required",
                                        "params": {
                                            "missingProperty": "payment",
                                        },
                                        "message": "should have required property payment",
                                    },
                                ],
                            },
                        ],
                    };
                    expect(jsonBody).toMatchObject(expected);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    describe("Optional secret tests",() =>{
        test("It should reject incorrect secret if WEBHOOK_SECRET is set",(done)=>{
            process.env.WEBHOOK_SECRET = "theSecret";
            const topicArn = 'arn::topic';
            process.env.TOPIC_ARN = topicArn;
            const publishSpy = Sinon.spy((params, callback) => {
                callback(undefined, {MessageId: '1234567'});
            });
            AWSMock.mock('SNS', 'publish', publishSpy);
            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        secret: 'wrongSecret',
                        payment: {},
                    }),
                },
            });
            handle(evt as APIGatewayEvent, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(403);
                    expect(publishSpy.notCalled).toBeTruthy();
                    expect(res!.body).toBeDefined();
                    const jsonBody = JSON.parse(res!.body);
                    const expected = {
                        errors: [
                            {
                                "status": 403,
                                "message": "Wrong",
                            },
                        ],
                    };
                    expect(jsonBody).toMatchObject(expected);
                    done();
                } catch (err) {
                    done(err);
                }


            });
        })
    });
    describe("Valid request tests", () => {


        test("It should publish to the queue", (done) => {

            const topicArn = 'arn::topic';
            process.env.TOPIC_ARN = topicArn;
            const publishSpy = Sinon.spy((params, callback) => {
                callback(undefined, {MessageId: '1234567'});
            });
            AWSMock.mock('SNS', 'publish', publishSpy);
            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        secret: 'secret',
                        payment: {},
                    }),
                },
            });
            handle(evt as APIGatewayEvent, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();

                    expect(publishSpy.calledOnce).toBeTruthy();
                    expect(
                        publishSpy.calledWith({
                            Message: JSON.stringify(evt.body),
                            TopicArn: topicArn,
                        })).toBeTruthy();
                    done();
                } catch (err) {
                    done(err);
                }


            });


        });

        test("It should return an accepted response", (done) => {
            // Setup Mocks
            AWSMock.mock('SNS', 'publish', (params, callback) => {
                callback(undefined, {MessageId: '1234567'});
            });

            const ctx = context();
            const evt = createEvent({
                template: 'aws:apiGateway',
                merge: {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        secret: 'secret',
                        payment: {},
                    }),
                },
            });
            handle(evt as APIGatewayEvent, ctx, (error, res) => {
                try {
                    expect(error).toBeNull();
                    expect(res).toBeDefined();
                    expect(res!.statusCode).toBe(202);
                    expect(res!.body).toBeDefined();
                    const json = JSON.parse(res!.body);
                    expect(json).toBeDefined();
                    expect(json.message).toBe('Update event accepted.');
                    done();
                } catch (err) {
                    done(err);
                }


            });


        });


    });


});