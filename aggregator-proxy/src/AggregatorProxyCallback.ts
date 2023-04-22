import fetch from "node-fetch";
import Koa from "koa";
import cors from "@koa/cors";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import {
  Aggregator,
  BlsWalletWrapper,
  Bundle,
  bundleFromDto,
} from "bls-wallet-clients";
import reporter from "io-ts-reporters";
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

import httpExecute from "./httpExecute"
import config from "./config"

import BundleDto from "./BundleDto";

(globalThis as any).fetch ??= fetch;





async function getBundle(transData: any, blsWallet: any, nounce: string) {
  // if(blsWalletBalance < ethValue){
  //     const transTx = {
  //         from: transData.from,
  //         to: blsWallet.address,
  //         value: ethValue,
  //         data: transData.data,
  //         chainId: transData.chainId,
  //     }
  //     const sendtx = await wallet.sendRawTransaction(transTx, provider);
  //     sendtx.wait();
  // }
  console.log("getBundle=====");
  const nonce = String(await blsWallet.Nonce());
  // const ethValue = ethers.utils.parseEther("0.01")

  // All of the actions in a bundle are atomic, if one
  // action fails they will all fail.
  // log.debug("ethValue:", ethValue);
  // log.debug("contractAddress:", transData.to);
  // log.debug("encodedFunction:", encodedFunction);

  const bundle = blsWallet.sign({
    nonce,
    actions: [
      {
        ethValue: String(transData["value"]),
        contractAddress: transData["to"],
        encodedFunction: transData["encodedFunction"],
      },
    ],
  });
  return bundle;
}

export default function AggregatorProxyCallback(
  bundleTransformer: (clientBundle: Bundle) => Bundle | Promise<Bundle>,
) {
  const app = new Koa();
  app.use(cors());

  const router = new Router();

  router.post("/bundle", bodyParser(), async (ctx) => {
    console.log("bundle=====");
    const transData: any = ctx.request.body;
      console.log("transData=", transData);
    try {
      const verifyTokenResult = await httpExecute.verifyToken(
        String(ctx.header["access-token"]),
      );
      if (verifyTokenResult.code != 200) {
        ctx.status = verifyTokenResult.code;
        ctx.body = verifyTokenResult.message == null || verifyTokenResult.message == "" ? verifyTokenResult.msg : verifyTokenResult.message;
        return;
      } else {
        if (!verifyTokenResult.data.pass) {
          ctx.status = 403;
          ctx.body = "permission denied";
          return;
        }
      }

      
      const chainId = ctx.header["chain-id"];
      if(chainId == null || chainId == "" || chainId == undefined){
        console.log("chain-id is empty")
        ctx.status = 500;
        ctx.body = "chain-id is empty";
        return;
      }
      const chainProperty = config.getChainProperty(String(chainId));
      const aggregatorUrl = chainProperty.AGGREGATOR_URL;
      const verificationGatewayUrl = chainProperty.VERIFICATION_GATEWAY;
      const jsonRpcUrl = chainProperty.JSON_RPC_URL;
      if(aggregatorUrl == null || aggregatorUrl == "" ||
          verificationGatewayUrl == null || verificationGatewayUrl == "" ||
          jsonRpcUrl == null || jsonRpcUrl == ""){
        console.log(`not support this chain [${chainId}]`)
        ctx.status = 500;
        ctx.body = `not support this chain [${chainId}]` ;
        return;
      }
      
      const upstreamAggregator = new Aggregator(aggregatorUrl);

      let privateKey = transData["privateKey"];
      console.log("transData=", transData);
      if (privateKey == null || privateKey == "" || privateKey == undefined || privateKey == "0x") {
        const getPrivateKeyResult = await httpExecute.getPrivateKey(
          transData["sessionToken"],
        );

        if (getPrivateKeyResult.code != 200) {
          ctx.status = getPrivateKeyResult.code;
          ctx.body = getPrivateKeyResult.message == null || getPrivateKeyResult.message == "" ? getPrivateKeyResult.msg : getPrivateKeyResult.message;
          return;
        } else {
          if (getPrivateKeyResult.data == "") {
            ctx.status = 403;
            ctx.body = "permission denied";
            return;
          }
          privateKey = "0x" + getPrivateKeyResult.data;
        }
      }

      const provider = new ethers.providers.JsonRpcProvider({
        url: jsonRpcUrl,
        headers: { chainId: transData["chainId"] },
      });
      const blsWallet = await BlsWalletWrapper.connect(
        privateKey,
        verificationGatewayUrl,
        provider,
      );
      const nounce = String(await blsWallet.Nonce());

      const transformedBundle = await getBundle(transData, blsWallet, nounce);
      const estimateFeeResult = await upstreamAggregator.estimateFee(
        transformedBundle,
      );
      console.log("estimateFee=====");
      const addResult = await upstreamAggregator.add(transformedBundle);
      console.log("addbundle=====");

      ctx.status = 200;
      ctx.body = addResult;
      ctx.body.feeRequired = estimateFeeResult.feeRequired;
      ctx.body.nonce = nounce;
      ctx.body.blsAddress = blsWallet.address;
    } catch (error) {
      console.log("bundle error=", error);
      ctx.status = 500;
      ctx.body = "execute bundle error:" + error;
      return;
    }
  });

  router.post("/estimateFee", bodyParser(), async (ctx) => {
    console.log("estimateFee=====");
    try {
      const verifyTokenResult = await httpExecute.verifyToken(
        String(ctx.header["access-token"]),
      );
      if (verifyTokenResult.code != 200) {
        ctx.status = verifyTokenResult.code;
        ctx.body = verifyTokenResult.message || verifyTokenResult.message == "" ? verifyTokenResult.msg : verifyTokenResult.message;
        return;
      } else {
        if (!verifyTokenResult.data.pass) {
          ctx.status = 403;
          ctx.body = "permission denied";
          return;
        }
      }
      

      const chainId = ctx.header["chain-id"];
      if(chainId == null || chainId == "" || chainId == undefined){
        console.log("chain-id is empty")
        ctx.status = 500;
        ctx.body = "chain-id is empty";
        return;
      }
      const chainProperty = config.getChainProperty(String(chainId));
      const aggregatorUrl = chainProperty.AGGREGATOR_URL;
      const verificationGatewayUrl = chainProperty.VERIFICATION_GATEWAY;
      const jsonRpcUrl = chainProperty.JSON_RPC_URL;
      if(aggregatorUrl == null || aggregatorUrl == "" ||
          verificationGatewayUrl == null || verificationGatewayUrl == "" ||
          jsonRpcUrl == null || jsonRpcUrl == ""){
        console.log(`not support this chain [${chainId}]`)
        ctx.status = 500;
        ctx.body = `not support this chain [${chainId}]` ;
        return;
      }
      
      const upstreamAggregator = new Aggregator(aggregatorUrl);
      const provider = new ethers.providers.JsonRpcProvider({
        url: jsonRpcUrl,
        headers: { chainId: String(chainId) },
      });


      let transData: any = ctx.request.body;
      let privateKey = transData["privateKey"];
      if (privateKey == null || privateKey == "") {
        const getPrivateKeyResult = await httpExecute.getPrivateKey(
          transData["sessionToken"],
        );

        if (getPrivateKeyResult.code != 200) {
          ctx.status = getPrivateKeyResult.code;
          ctx.body = getPrivateKeyResult.message || getPrivateKeyResult.message == "" ? getPrivateKeyResult.msg : getPrivateKeyResult.message;
          return;
        } else {
          if (getPrivateKeyResult.data == "") {
            ctx.status = 403;
            ctx.body = "permission denied";
            return;
          }
          privateKey = "0x" + getPrivateKeyResult.data;
        }
      }

      const blsWallet = await BlsWalletWrapper.connect(
        privateKey,
        verificationGatewayUrl,
        provider,
      );
      const nounce = String(await blsWallet.Nonce());

      const transformedBundle = await getBundle(transData, blsWallet, nounce);
      const estimateFeeResult = await upstreamAggregator.estimateFee(
        transformedBundle,
      );
      console.log("estimateFeeResult=====");
      ctx.status = 200;
      ctx.body = estimateFeeResult;
    } catch (error) {
      console.log("estimateFee error=", error);
      ctx.status = 500;
      ctx.body = "execute bundle error:" + error;
      return;
    }
  });

  router.post("/bundleForLocal", bodyParser(), async (ctx) => {
    console.log("bundleForLocal=====");
    try {
      const verifyTokenResult = await httpExecute.verifyToken(
        String(ctx.header["access-token"]),
      );
      if (verifyTokenResult.code != 200) {
        ctx.status = verifyTokenResult.code;
        ctx.body = verifyTokenResult.message || verifyTokenResult.message == "" ? verifyTokenResult.msg : verifyTokenResult.message;
        return;
      } else {
        if (!verifyTokenResult.data.pass) {
          ctx.status = 403;
          ctx.body = "permission denied";
          return;
        }
      }

      const decodeResult = BundleDto.decode(ctx.request.body);

      if ("left" in decodeResult) {
        ctx.status = 400;
        ctx.body = reporter.report(decodeResult);
        return;
      }

      const clientBundle = bundleFromDto(decodeResult.right);
      const transformedBundle = await bundleTransformer(clientBundle);


      const chainId = ctx.header["chain-id"];
      if(chainId == null || chainId == "" || chainId == undefined){
        console.log("chain-id is empty")
        ctx.status = 500;
        ctx.body = "chain-id is empty";
        return;
      }
      const chainProperty = config.getChainProperty(String(chainId));
      const aggregatorUrl = chainProperty.AGGREGATOR_URL;
      const verificationGatewayUrl = chainProperty.VERIFICATION_GATEWAY;
      const jsonRpcUrl = chainProperty.JSON_RPC_URL;
      if(aggregatorUrl == null || aggregatorUrl == "" ||
          verificationGatewayUrl == null || verificationGatewayUrl == "" ||
          jsonRpcUrl == null || jsonRpcUrl == ""){
        console.log(`not support this chain [${chainId}]`)
        ctx.status = 500;
        ctx.body = `not support this chain [${chainId}]` ;
        return;
      }
      
      const upstreamAggregator = new Aggregator(aggregatorUrl);


      const estimateFeeResult = await upstreamAggregator.estimateFee(
        transformedBundle,
      );
      console.log("estimateFeeResult=====");
      const addResult = await upstreamAggregator.add(transformedBundle);
      console.log("addbundle=====");

      ctx.status = 200;
      ctx.body = addResult;
      ctx.body.feeRequired = estimateFeeResult.feeRequired;
    } catch (error) {
      console.log("bundleForLocal error=", error);
      ctx.status = 500;
      ctx.body = "execute bundle error:" + error;
      return;
    }
  });

  router.post("/estimateFeeForLocal", bodyParser(), async (ctx) => {
    console.log("estimateFeeForLocal=====");
    try {

      const decodeResult = BundleDto.decode(ctx.request.body);

      if ("left" in decodeResult) {
        ctx.status = 400;
        ctx.body = reporter.report(decodeResult);
        return;
      }

      const clientBundle = bundleFromDto(decodeResult.right);
      const transformedBundle = await bundleTransformer(clientBundle);

      const chainId = ctx.header["chain-id"];
      if(chainId == null || chainId == "" || chainId == undefined){
        console.log("chain-id is empty")
        ctx.status = 500;
        ctx.body = "chain-id is empty";
        return;
      }
      const chainProperty = config.getChainProperty(String(chainId));
      const aggregatorUrl = chainProperty.AGGREGATOR_URL;
      const verificationGatewayUrl = chainProperty.VERIFICATION_GATEWAY;
      const jsonRpcUrl = chainProperty.JSON_RPC_URL;
      if(aggregatorUrl == null || aggregatorUrl == "" ||
          verificationGatewayUrl == null || verificationGatewayUrl == "" ||
          jsonRpcUrl == null || jsonRpcUrl == ""){
        console.log(`not support this chain [${chainId}]`)
        ctx.status = 500;
        ctx.body = `not support this chain [${chainId}]` ;
        return;
      }
      
      const upstreamAggregator = new Aggregator(aggregatorUrl);

      const estimateFeeResult = await upstreamAggregator.estimateFee(
        transformedBundle,
      );
      console.log("estimateFeeResult=====");

      ctx.status = 200;
      ctx.body = estimateFeeResult;
    } catch (error) {
      console.log("estimateFeeForLocal error=", error);
      ctx.status = 500;
      ctx.body = "execute bundle error:" + error;
      return;
    }
  });

  router.get("/bundleReceipt/:hash", bodyParser(), async (ctx) => {
    console.log("bundleReceipt=====",ctx.params.hash);

    const chainId = ctx.header["chain-id"];
    if(chainId == null || chainId == "" || chainId == undefined){
      console.log("chain-id is empty")
      ctx.status = 500;
      ctx.body = "chain-id is empty";
      return;
    }
    const chainProperty = config.getChainProperty(String(chainId));
    const aggregatorUrl = chainProperty.AGGREGATOR_URL;
    const verificationGatewayUrl = chainProperty.VERIFICATION_GATEWAY;
    const jsonRpcUrl = chainProperty.JSON_RPC_URL;
    if(aggregatorUrl == null || aggregatorUrl == "" ||
        verificationGatewayUrl == null || verificationGatewayUrl == "" ||
        jsonRpcUrl == null || jsonRpcUrl == ""){
      console.log(`not support this chain [${chainId}]`)
      ctx.status = 500;
      ctx.body = `not support this chain [${chainId}]` ;
      return;
    }
    
    const upstreamAggregator = new Aggregator(aggregatorUrl);

    const lookupResult = await upstreamAggregator.lookupReceipt(
      ctx.params.hash,
    );

    if (lookupResult === undefined) {
      ctx.status = 404;
    } else {
      ctx.status = 200;
      ctx.body = lookupResult;
    }
  });

  router.post("/getBlsAddress", bodyParser(), async (ctx) => {
    console.log("getBlsAddress=====",ctx.request.body);
    try {
      const transData: any = ctx.request.body;
      console.log("transData=", transData);
      if (transData == null || transData == "") {
        ctx.status = 403;
        ctx.body = "param is empty";
        return;
      }

      const awsSecretName = transData["awsSecretName"];
      if (awsSecretName == null || awsSecretName == "" || awsSecretName == undefined) {
        ctx.status = 403;
        ctx.body = "param is empty";
        return;
      }
      
      const chainId = ctx.header["chain-id"];
      if(chainId == null || chainId == "" || chainId == undefined){
        console.log("chain-id is empty")
        ctx.status = 500;
        ctx.body = "chain-id is empty";
        return;
      }
      const chainProperty = config.getChainProperty(String(chainId));
      const aggregatorUrl = chainProperty.AGGREGATOR_URL;
      const verificationGatewayUrl = chainProperty.VERIFICATION_GATEWAY;
      const jsonRpcUrl = chainProperty.JSON_RPC_URL;
      if(aggregatorUrl == null || aggregatorUrl == "" ||
          verificationGatewayUrl == null || verificationGatewayUrl == "" ||
          jsonRpcUrl == null || jsonRpcUrl == ""){
        console.log(`not support this chain [${chainId}]`)
        ctx.status = 500;
        ctx.body = `not support this chain [${chainId}]` ;
        return;
      }

      let privateKey = String(await config.getAwsSecretValue(awsSecretName));
      if (privateKey == null || privateKey == undefined || privateKey == "" || privateKey == "0x") {
        ctx.status = 500;
        ctx.body = "privateKey not existed";
        return;
      }
      if(!privateKey.startsWith("0x") && !privateKey.startsWith("0X")){
        privateKey = "0x" + privateKey;
      }
      
      const provider = new ethers.providers.JsonRpcProvider({
        url: jsonRpcUrl,
        headers: { chainId: String(chainId) },
      });
      const blsWallet = await BlsWalletWrapper.connect(
        privateKey,
        verificationGatewayUrl,
        provider,
      );

      ctx.status = 200;
      ctx.body = {
        blsAddress:blsWallet.address
      };
    } catch (error) {
      console.log("getBlsAddress error=", error);
      ctx.status = 500;
      ctx.body = "getBlsAddress error:" + error;
      return;
    }
  });

  router.post("/bundleForBackendOld", bodyParser(), async (ctx) => {
    console.log("bundleForBackendOld=====");
    try {
      let transData: any = ctx.request.body;
      console.log("transData=", transData);

      const chainId = ctx.header["chain-id"];
      if(chainId == null || chainId == "" || chainId == undefined){
        console.log("chain-id is empty")
        ctx.status = 500;
        ctx.body = "chain-id is empty";
        return;
      }
      const chainProperty = config.
      getChainProperty(String(chainId));
      const aggregatorUrl = chainProperty.AGGREGATOR_URL;
      const verificationGatewayUrl = chainProperty.VERIFICATION_GATEWAY;
      const jsonRpcUrl = chainProperty.JSON_RPC_URL;
      if(aggregatorUrl == null || aggregatorUrl == "" ||
          verificationGatewayUrl == null || verificationGatewayUrl == "" ||
          jsonRpcUrl == null || jsonRpcUrl == ""){
        console.log(`not support this chain [${chainId}]`)
        ctx.status = 500;
        ctx.body = `not support this chain [${chainId}]` ;
        return;
      }

      const upstreamAggregator = new Aggregator(aggregatorUrl);

      const awsSecretName = transData["awsSecretName"];
      if (awsSecretName == null || awsSecretName == "" || awsSecretName == undefined) {
        ctx.status = 403;
        ctx.body = "param is empty";
        return;
      }
      let privateKey = String(await config.getAwsSecretValue(awsSecretName));
      if (privateKey == null || privateKey == undefined || privateKey == "" || privateKey == "0x") {
        ctx.status = 500;
        ctx.body = "privateKey not existed";
        return;
      }
      if(!privateKey.startsWith("0x") && !privateKey.startsWith("0X")){
        privateKey = "0x" + privateKey;
      }
      
      const provider = new ethers.providers.JsonRpcProvider({
        url: jsonRpcUrl,
        headers: { chainId: String(chainId) },
      });
      const blsWallet = await BlsWalletWrapper.connect(
        privateKey,
        verificationGatewayUrl,
        provider,
      );
      const nounce = String(await blsWallet.Nonce());

      const transformedBundle = await getBundle(transData, blsWallet, nounce);
      const estimateFeeResult = await upstreamAggregator.estimateFee(
        transformedBundle,
      );
      console.log("estimateFee=====");
      const addResult = await upstreamAggregator.add(transformedBundle);
      console.log("addbundle=====");

      ctx.status = 200;
      ctx.body = addResult;
      ctx.body.feeRequired = estimateFeeResult.feeRequired;
      ctx.body.nonce = nounce;
      ctx.body.blsAddress = blsWallet.address;
    } catch (error) {
      console.log("bundleForBackend error=", error);
      ctx.status = 500;
      ctx.body = "execute bundle error:" + error;
      return;
    }
  });

  router.post("/bundleForBackend", bodyParser(), async (ctx) => {
    console.log("bundleForBackend=====",ctx.request.body);
    try {
      let transData: any = ctx.request.body;
      // console.log("transData=", transData);

      const chainId = ctx.header["chain-id"];
      if(chainId == null || chainId == "" || chainId == undefined){
        console.log("chain-id is empty")
        ctx.status = 500;
        ctx.body = "chain-id is empty";
        return;
      }
      const chainProperty = config.
      getChainProperty(String(chainId));
      const aggregatorUrl = chainProperty.AGGREGATOR_URL;
      const verificationGatewayUrl = chainProperty.VERIFICATION_GATEWAY;
      const jsonRpcUrl = chainProperty.JSON_RPC_URL;
      if(aggregatorUrl == null || aggregatorUrl == "" ||
          verificationGatewayUrl == null || verificationGatewayUrl == "" ||
          jsonRpcUrl == null || jsonRpcUrl == ""){
        console.log(`not support this chain [${chainId}]`)
        ctx.status = 500;
        ctx.body = `not support this chain [${chainId}]` ;
        return;
      }

      const upstreamAggregator = new Aggregator(aggregatorUrl);

      const awsSecretName = transData["awsSecretName"];
      const funcAbi = transData["funcAbi"];
      const method = transData["method"];
      const args = transData["args"];
      if (awsSecretName == null || awsSecretName == "" || awsSecretName == undefined
        || funcAbi == null || funcAbi == "" || funcAbi == undefined
        || method == null || method == "" || method == undefined
        || args == null || args == undefined) {
        ctx.status = 500;
        ctx.body = "param is empty";
        return;
      }

      let transArgs = [];
      const abiParamsAttr = funcAbi.split('(');
      console.log("abiParamsAttr=", abiParamsAttr)
      if(abiParamsAttr.length < 2){
        ctx.status = 500;
        ctx.body = "funcAbi is error";
        return;
      }
      const abiParamsAttr2 = abiParamsAttr[1].split(')');
      console.log("abiParamsAttr2=", abiParamsAttr)
      if(abiParamsAttr2.length < 2){
        ctx.status = 500;
        ctx.body = "funcAbi is error";
        return;
      }
      const abiParamsAttr3 = abiParamsAttr2[0];
      console.log("abiParamsAttr3=", abiParamsAttr3)
      if(abiParamsAttr3.length > 0){
        const abiParamsAttrs = abiParamsAttr3.split(",");
        if(abiParamsAttrs.length != args.length){
          ctx.status = 500;
          ctx.body = "funcAbi not match with args";
          return;
        }
        for(var i = 0;i< abiParamsAttrs.length; i++){
          const paramType = abiParamsAttrs[i].trim().split(" ")[0];
          if(paramType == "address"){
            transArgs.push(args[i]);
          }else if(paramType == "uint256" || paramType == "uint"){
            transArgs.push(ethers.utils.parseUnits(args[i], 18));
          }else if(paramType == "bytes32"){
            transArgs.push(ethers.utils.formatBytes32String(args[i]));
          }else if(paramType == "bytes"){
            transArgs.push(ethers.utils.toUtf8Bytes(args[i]));
          }else{
            transArgs.push(args[i]);
          }
        }
      }
      const abiFace = new ethers.utils.Interface([funcAbi]);
      
      transData["encodedFunction"] = abiFace.encodeFunctionData(method, transArgs);
      console.log("transData[encodedFunction]=", transData["encodedFunction"])
        
      let privateKey = String(await config.getAwsSecretValue(awsSecretName));
      if (privateKey == null || privateKey == undefined || privateKey == "" || privateKey == "0x") {
        ctx.status = 500;
        ctx.body = "privateKey not existed";
        return;
      }
      if(!privateKey.startsWith("0x") && !privateKey.startsWith("0X")){
        privateKey = "0x" + privateKey;
      }
      
      const provider = new ethers.providers.JsonRpcProvider({
        url: jsonRpcUrl,
        headers: { chainId: String(chainId) },
      });
      const blsWallet = await BlsWalletWrapper.connect(
        privateKey,
        verificationGatewayUrl,
        provider,
      );
      const nounce = String(await blsWallet.Nonce());

      console.log("nonce:",nounce)

      const transformedBundle = await getBundle(transData, blsWallet, nounce);
      const estimateFeeResult = await upstreamAggregator.estimateFee(
        transformedBundle,
      );
      
      console.log("estimateFee=====");
      const addResult = await upstreamAggregator.add(transformedBundle);
      console.log("addbundle=====",addResult);

      ctx.status = 200;
      ctx.body = addResult;
      ctx.body.feeRequired = estimateFeeResult.feeRequired;
      ctx.body.nonce = nounce;
      ctx.body.blsAddress = blsWallet.address;
    } catch (error) {
      console.log("bundleForBackend error=", error);
      ctx.status = 500;
      ctx.body = "execute bundle error:" + error;
      return;
    }
  });

  router.get("/status", bodyParser(), async (ctx) => {
    ctx.status = 200;
    ctx.body = "ok";
  });

  router.get("/bundles/:chainId/:limit/:status", bodyParser(), async (ctx) => {
    
    const data = await httpExecute.requestAggregator(ctx.params.chainId,parseInt(ctx.params.limit),ctx.params.status)
    ctx.status = 200;
    ctx.body = data;
  });

  router.get("/bundlesclear/:chainId", bodyParser(), async (ctx) => {
    
    await httpExecute.clearBundle(ctx.params.chainId)
    ctx.status = 200;
    ctx.body = "ok";
  });

  app.use(router.routes());

  return app.callback();
}
