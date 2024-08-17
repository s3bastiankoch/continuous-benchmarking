import { Context, APIGatewayProxyResult, APIGatewayEvent } from "aws-lambda";
import { piWithMonteCarlo } from "./pi";

const n = process.env.N_ITERATIONS ? parseInt(process.env.N_ITERATIONS) : 0;

export const handler = async (
  _event: APIGatewayEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  const pi = piWithMonteCarlo(n);

  // Ping https://api.ipify.org
  //   const response = await fetch("https://api.ipify.org");

  return {
    statusCode: 200,
    body: JSON.stringify({
      pi,
      n,
      //   ip: await response.text(),
    }),
  };
};
