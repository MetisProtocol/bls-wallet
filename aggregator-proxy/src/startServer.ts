import runAggregatorProxy from "./runAggregatorProxy";

import dotenv from 'dotenv';
dotenv.config();

const AggregatorUrl:any=process.env.AGGREGATOR_URL
const AggregatorPort:any=process.env.AGGREGATOR_PROXY_PORT
const VerificationGatewayUrl:any=process.env.VERIFICATION_GATEWAY
const JsonRpcUrl:any=process.env.JSON_RPC_URL
console.log("AGGREGATOR_URL:",process.env.AGGREGATOR_URL)
runAggregatorProxy(
  AggregatorUrl,
  VerificationGatewayUrl,
  JsonRpcUrl,
  AggregatorPort,
  '0.0.0.0',
  () => {
    console.log('Proxying aggregator on port ', AggregatorPort);
  },
);
