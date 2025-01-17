import { Context, APIGatewayProxyResult, APIGatewayEvent } from "aws-lambda";
import { sieveOfEratosthenes } from "./sieve-of-eratosthenes";

// const n = process.env.N_ITERATIONS ? parseInt(process.env.N_ITERATIONS) : 0;
const n = 525_000;

export const handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const primeNumbers = sieveOfEratosthenes(n);

  return {
    statusCode: 200,
    body: JSON.stringify({
      primeNumbers,
      n,
    }),
  };
};
