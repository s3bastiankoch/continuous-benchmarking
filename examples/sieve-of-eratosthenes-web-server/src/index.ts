import cluster from "cluster";
import { availableParallelism } from "os";
import express from "express";
import { Context, APIGatewayEvent } from "aws-lambda";

import { handler as handlerV1 } from "./v1";
import { handler as handlerV2 } from "./v2";

let isColdStart = true;

const numCPUs = availableParallelism();

function retrieveLambdaContext(headers: express.Request["headers"]) {
  let lambdaContext: Context | null = null;
  let requestContext: APIGatewayEvent["requestContext"] | null = null;

  if ("x-amzn-lambda-context" in headers) {
    lambdaContext = JSON.parse(headers["x-amzn-lambda-context"] as string);
  }

  if ("x-amzn-request-context" in headers) {
    requestContext = JSON.parse(headers["x-amzn-request-context"] as string);
  }

  return { lambdaContext, requestContext };
}

if (cluster.isPrimary) {
  console.log(`Master process ${process.pid} is running`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker process ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  const app = express();

  app.post("/v1", async (req, res) => {
    const temp = isColdStart;
    isColdStart = false;

    const { lambdaContext, requestContext } = retrieveLambdaContext(
      req.headers
    );

    if (!requestContext || !lambdaContext) {
      res.status(400).json({
        error: "Bad request",
      });
      return;
    }

    // TODO
    const event: APIGatewayEvent = {
      requestContext,
      body: req.body,
      headers: {},
      httpMethod: req.method,
      isBase64Encoded: false,
      multiValueHeaders: {},
      multiValueQueryStringParameters: {},
      path: req.path,
      pathParameters: {},
      queryStringParameters: {},
      resource: "",
      stageVariables: {},
    };

    const start = performance.now();
    const result = await handlerV1(event, lambdaContext);
    const duration = performance.now() - start;

    res.json({
      result,
      processId: process.pid,
      numCPUs,
      isColdStart: temp,
      duration,
    });
  });

  app.post("/v2", async (req, res) => {
    const temp = isColdStart;
    isColdStart = false;

    const { lambdaContext, requestContext } = retrieveLambdaContext(
      req.headers
    );

    if (!requestContext || !lambdaContext) {
      res.status(400).json({
        error: "Bad request",
      });
      return;
    }

    // TODO
    const event: APIGatewayEvent = {
      requestContext,
      body: req.body,
      headers: {},
      httpMethod: req.method,
      isBase64Encoded: false,
      multiValueHeaders: {},
      multiValueQueryStringParameters: {},
      path: req.path,
      pathParameters: {},
      queryStringParameters: {},
      resource: "",
      stageVariables: {},
    };

    const start = performance.now();
    const result = await handlerV2(event, lambdaContext);
    const duration = performance.now() - start;

    res.json({
      result,
      processId: process.pid,
      numCPUs,
      isColdStart: temp,
      duration,
    });
  });

  const port = process.env.PORT || 8080;

  app.listen(port, () => {
    console.log(`Worker process ${process.pid} is listening on port ${port}`);
  });
}
