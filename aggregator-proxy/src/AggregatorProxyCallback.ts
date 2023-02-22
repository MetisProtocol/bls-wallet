import fetch from 'node-fetch';
import Koa from 'koa';
import cors from '@koa/cors';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import { Aggregator } from 'bls-wallet-clients';
import httpClient from "./httpClient";
import { BlsWalletWrapper } from "bls-wallet-clients";
import { ethers } from "ethers";
import dotenv from 'dotenv';
dotenv.config();


(globalThis as any).fetch ??= fetch;


async function verifyToken(accessToken: string){
  const metisUrl:any = process.env.METIS_URL;
  const verifyTokenResult = await httpClient.sendTrans(metisUrl, "api/v1/verify_token", "token=" + accessToken, 'get', '');
  return verifyTokenResult;
}

async function getPrivateKey(sessionToken:string) {
  const metisUrl:any = process.env.METIS_URL;
  const getPrivateKeyResult = await httpClient.sendTrans(metisUrl, "api/v1/service/wallet/export_key_without_check", null, 'post', sessionToken);
  return getPrivateKeyResult;
}

async function getBundle(verificationGatewayUrl: string, jsonRpcUrl: string, privateKey: string, transData: any){
  console.log("privateKey=",transData["privateKey"])
  console.log("sessionToken=",transData["sessionToken"])
  console.log("chainId=",transData["chainId"])
  console.log("value=",transData["value"])
  console.log("to=",transData["to"])
  console.log("encodedFunction=",transData["encodedFunction"])
  
  const provider = new ethers.providers.JsonRpcProvider({
    url: jsonRpcUrl,
    headers: {chainId: transData["chainId"]}
  });
  const blsWallet = await BlsWalletWrapper.connect(
      privateKey,
      verificationGatewayUrl,
      provider
  );
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

  const nonce = await blsWallet.Nonce() + "";
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
              ethValue: transData["value"]+"",
              contractAddress: transData["to"],
              encodedFunction: transData["encodedFunction"]
          },
      ],
  });
  return bundle;
}


export default function AggregatorProxyCallback(
  upstreamAggregatorUrl: string,
  verificationGatewayUrl: string,
  jsonRpcUrl: string
) {
  const app = new Koa();
  app.use(cors());
  const upstreamAggregator = new Aggregator(upstreamAggregatorUrl);

  const router = new Router();

  router.post('/bundle', bodyParser(), async (ctx) => {
    const verifyTokenResult = await verifyToken(ctx.header["access-token"] + "");
    if(verifyTokenResult.code != 200){
      ctx.status = verifyTokenResult.code;
      ctx.body = verifyTokenResult.message;
      return;
    } else {
      if(!verifyTokenResult.data.pass){
        ctx.status = 403;
        ctx.body = "permission denied";
        return;
      }
    }

    // const decodeResult = BundleDto.decode(ctx.request.body);

    // if ('left' in decodeResult) {
    //   ctx.status = 400;
    //   ctx.body = reporter.report(decodeResult);
    //   return;
    // }

    // const clientBundle = bundleFromDto(decodeResult.right);
    // const transformedBundle = await bundleTransformer(clientBundle);

    let transData: any = ctx.request.body;
    let privateKey = transData["privateKey"];
    console.log("privateKey=", privateKey)
    if(privateKey == null || privateKey== ""){
      const getPrivateKeyResult = await getPrivateKey(transData["sessionToken"]);
      
      if(getPrivateKeyResult.code != 200){
        ctx.status = getPrivateKeyResult.code;
        ctx.body = getPrivateKeyResult.message;
        return;
      } else {
        if(getPrivateKeyResult.data == ""){
          ctx.status = 403;
          ctx.body = "permission denied";
          return;
        }
        privateKey = "0x" + getPrivateKeyResult.data;
      }
    }

    const transformedBundle = await getBundle(verificationGatewayUrl, jsonRpcUrl, privateKey, transData)
    const addResult = await upstreamAggregator.add(transformedBundle);

    ctx.status = 200;
    ctx.body = addResult;
  });

  router.post('/estimateFee', bodyParser(), async (ctx) => {
    console.log("1")
    const verifyTokenResult = await verifyToken(ctx.header["access-token"] + "");
    if(verifyTokenResult.code != 200){
      ctx.status = verifyTokenResult.code;
      ctx.body = verifyTokenResult.message;
      return;
    } else {
      if(!verifyTokenResult.data.pass){
        ctx.status = 403;
        ctx.body = "permission denied";
        return;
      }
    }
    console.log("2")
    // const decodeResult = BundleDto.decode(ctx.request.body);

    // if ('left' in decodeResult) {
    //   ctx.status = 400;
    //   ctx.body = reporter.report(decodeResult);
    //   return;
    // }

    // const clientBundle = bundleFromDto(decodeResult.right);
    // const transformedBundle = await bundleTransformer(clientBundle);
    
    let transData: any = ctx.request.body;
    let privateKey = transData["privateKey"];
    console.log("3")
    console.log("transData=", ctx.request.body)
    console.log("privateKey=", transData["privateKey"])
    if(privateKey == null || privateKey== ""){
      const getPrivateKeyResult = await getPrivateKey(transData["sessionToken"]);
      
      if(getPrivateKeyResult.code != 200){
        ctx.status = getPrivateKeyResult.code;
        ctx.body = getPrivateKeyResult.message;
        return;
      } else {
        if(getPrivateKeyResult.data == ""){
          ctx.status = 403;
          ctx.body = "permission denied";
          return;
        }
        privateKey = "0x" + getPrivateKeyResult.data;
      }
    }
    console.log("4")
    console.log("5")
    const transformedBundle = await getBundle(verificationGatewayUrl, jsonRpcUrl, privateKey, transData)
    console.log("6")
    const estimateFeeResult = await upstreamAggregator.estimateFee(transformedBundle);
    console.log("7")
    ctx.status = 200;
    ctx.body = estimateFeeResult;
  });

  router.get('/bundleReceipt/:hash', bodyParser(), async (ctx) => {
    const lookupResult = await upstreamAggregator.lookupReceipt(ctx.params.hash);

    if (lookupResult === undefined) {
      ctx.status = 404;
    } else {
      ctx.status = 200;
      ctx.body = lookupResult;
    }
  });

  router.get('/status', bodyParser(), async (ctx) => {
      ctx.status = 200;  
      ctx.body = 'ok';  
  });

  app.use(router.routes());

  return app.callback();
}
