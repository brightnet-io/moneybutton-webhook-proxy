# Introduction

moneybutton-webhook-proxy allows sites and services that integrate with Money Button via Webhook calls to introduce a simple and effective retry capability between Money Button and their own endpoints.

It is built using [serverless](https://serverless.com) and runs on the AWS stack, making use of Lambda Functions and the native retry capability of SNS Topics when delivering to http/s subscribers.

> Note: The Lambda function that subscribes to the SNS topic is using the https protocol, NOT the lambda protocol. This is intentional as it allows the use of the http delivery retry  capability, which is more capable and configurable than native Lambda retries.



## Installation

Pre-requisites:

- [Node.js v10](https://nodejs.org) or later

- [Serverless](https://serverless.com/framework/docs/getting-started/) ([with AWS provider credentials](https://serverless.com/framework/docs/providers/aws/guide/credentials/))

  

Deployment

1. Clone the repo

```shell
git clone https://github.com/brightnet-io/moneybutton-webhook-proxy.git
```

2. Install Dependencies

```shell
npm install
```

3. Optional - Set webhook secret

`moneybutton-webhook-proxy` will only validate the secret in the payload if you add a secret to AWS SSM Parameter Store.  The secret name must be moneybuttonWebhookProxySecret and you add via the AWS console, or command line eg:

```shell
aws ssm put-parameter --name moneybuttonWebhookProxySecret --type String --value <SECRET> --region <AWS_REGION>
```

4. Deploy

```shell
sls deploy --stage production --region <AWS_REGION> --targetEndpoint <ENDPOINT_URL>
```

5. Manually confirm subscription

You will need to manually confirm the subscription of the `processSNSMessage` function to the SNS Topic. To do this you will need the endpoint for the API Gateway processSNSMessage endpoint. You can find this value as part of the output from `sls deploy`. It will look somthing like:

```shell
endpoints:
 POST - https://7d27sd32.execute-api.<aws_region>.amazonaws.com/<stage>/processSNSMessage
```

 

In the AWS console select Services->Simple Notification Services -> Subscriptions. 

In the search bar enter the endpoint url, select the correct result and click the "Request Confirmation" action button. That's it. The endpoint will confirm itself automatically.



# Message Delivery

When a webhook call is received by moneybutton-webhook-proxy, the payload goes through 5 phases.



The **consumption phase** ingests the original Webhook requests, performs very rudimentary validation, and transforms and publishes the original payload as an SNS message.

The **immediate delivery phase** is a 2-step process that includes the initial delivery attempt to your configured endpoint,  as well as 1 immediate retry attempts, with no delay. 

In the **Pre-Backoff phase** up to 2 attempts will be made to deliver the payload to the target endpoint with approximately a 120 second delay between unsuccessful attempts.

The **Backoff phase** applies an exponential backoff function for the delay between delivery attempts. This phase will make up to 6 additional attempts to deliver the payload  with increasing delays between each attempt.

The **Post-Backoff** phase is the final phase, and makes the final attempts to deliver the payload to your target endpoint. In this phase up to 2 attempts will be made to deliver the payload with a 10 minute interval between each attempt. Should the final attempt of the Post-Backoff phase fail, the message is discarded.

Through all of the above phases `moneybutton-servless-proxy` will make up to 12 attempts over a 60 minute period to deliver the payload received from Money Button to your configured endpoint.



> Note: At this time, CloudFormation, which is used for deployment of `moneybutton-webhook-proxy` does not allow the configuration of SNS delivery status logging. Please see the extra configuration section for tips on how you may enable this through AWS console.





# FAQ

## Will my endpoint receive that data in exactly the same order that it is sent from Money Button?

Short answer: Probably, if your endpoint is never down.

Long answer: No

Consider this excerpt from the SNS FAQs - 

> The Amazon SNS service will attempt to deliver messages from the 
> publisher in the order they were published into the topic. However, 
> network issues could potentially result in out-of-order messages at the 
> subscriber end.

Note that SNS will _"attempt"_ to deliver the messages in order, it does not guarantee it. Additionally the potential for _"network issues_" is why you are deploying `moneybutton-webhook-proxy` in the first place. If you receive a high volume of Money Button payments, the likelihood that you will receive messages out of order once your endpoint is down is quite high, anecdotal evidence from testing would suggest that it is almost a certainty.

Having said that, best practice for integration would see your endpoint being able to gracefully handle receiving messages out of order anyway,  specifically for any single Money Button payment, as the states and their potential transitions are relatively straightforward to handle if out of sequence.

If you do require guaranteed message order, [watch this space](https://github.com/brightnet-io/moneybutton-serverless-broker).



# Additional AWS Configuration

TODO



# Advanced Usage

> WARNING: Don't change any of these settings unless you are absolutely sure you understand the consequences.

Disable Immediate Retry Attempt

 `moneybutton-webhook-proxy` is configured by default to make 1, and only 1 immediate retry attempt if the initial delivery fails. We strongly recommend you do not increase this value. You can however disable any immediate retries by setting the `IMMEDIATE_RETRIES` environment variable to 0 prior to deployment.

```

```

```

```