// const serverConfig = {
//   "upstreamAggregatorUrl": "http://127.0.0.1:3000",
//   "port": 8080
// }

// export default serverConfig

import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import dotenv from "dotenv";
dotenv.config();

async function getAwsSecretValue(awsSecretName: string){
  const secretRegion = process.env.SECRET_REGION;
  const client = new SecretsManagerClient({ region: secretRegion });
  const input = { // GetSecretValueRequest
    SecretId: awsSecretName, // required
    // VersionId: "STRING_VALUE",
    // VersionStage: "STRING_VALUE",
  };
  const command = new GetSecretValueCommand(input);
  const response = await client.send(command);
  console.log("response=", response);
  return response != null && response.SecretString != null ? response.SecretString : "";
}

function getChainProperty(chainId: string){
  let chainProperty = {
    AGGREGATOR_URL:"",
    VERIFICATION_GATEWAY:"",
    JSON_RPC_URL:"",
  };

  const ChainPropertyStr:any = process.env.CHAIN_PROPERTY;
  if(ChainPropertyStr != null && ChainPropertyStr != "" && ChainPropertyStr != undefined){
    let chains: any = JSON.parse(ChainPropertyStr);
    if(chains != null && chains[chainId] != null){
      chainProperty.AGGREGATOR_URL = chains[chainId]["AGGREGATOR_URL"];
      chainProperty.VERIFICATION_GATEWAY = chains[chainId]["VERIFICATION_GATEWAY"];
      chainProperty.JSON_RPC_URL = chains[chainId]["JSON_RPC_URL"];
    }
  }    
  return chainProperty;
}

export default {
  getChainProperty,
  getAwsSecretValue,
}