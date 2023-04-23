
import { ethers } from "ethers";

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

export default{
  convertArgs
}