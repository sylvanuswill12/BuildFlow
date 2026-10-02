import serverless from "serverless-http";
import { createApp } from "../../server/_core/index";

type FunctionHandler = (event: object, context: object) => Promise<object>;
let handlerPromise: Promise<FunctionHandler> | undefined;

async function getHandler(): Promise<FunctionHandler> {
  if (!handlerPromise) {
    process.env.NODE_ENV = "production";
    const app = await createApp();
    handlerPromise = Promise.resolve(serverless(app, { requestId: "x-nf-request-id" }));
  }
  return handlerPromise;
}

export async function handler(event: object, context: object) {
  const apiHandler = await getHandler();
  return apiHandler(event, context);
}
