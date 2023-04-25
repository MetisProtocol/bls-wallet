
import { ethers } from "ethers";
import config from "./config"

export function convertArgs(funcAbi:string,args:any[]){
  const abiFace = new ethers.utils.Interface([funcAbi]);
  const inputs = Object.values(abiFace.functions)[0].inputs
  // console.log("abiFace inputs:",inputs);

  for(let i=0;i<inputs.length;i++){
      const paramType = inputs[i];
      if(paramType.type == "bytes32"){
          args[i] = ethers.utils.formatBytes32String(args[i])
      }else if(paramType.type == "bytes"){
        args[i] = ethers.utils.toUtf8Bytes(args[i])
      }
      //ethers.utils.parseUnits(args[i], 18)
  }
  return args;
}

export function getAggregatorUrl(chainId:any){
  const chainProperty = config.
  getChainProperty(String(chainId));
  const aggregatorUrl = chainProperty.AGGREGATOR_URL;
  const verificationGatewayUrl = chainProperty.VERIFICATION_GATEWAY;
  const jsonRpcUrl = chainProperty.JSON_RPC_URL;
  
}

export default{
  convertArgs
}