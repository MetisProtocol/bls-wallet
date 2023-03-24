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
import httpClient from "./httpClient";
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

import BundleDto from "./BundleDto";

(globalThis as any).fetch ??= fetch;

async function verifyToken(accessToken: string) {
  const metisUrl: any = process.env.METIS_URL;
  console.log("metisUrl=", metisUrl);
  console.log("verifyToken=====");
  const verifyTokenResult = await httpClient.sendTrans(
    metisUrl,
    "api/v1/verify_token",
    "token=" + accessToken,
    "get",
    "",
  );
  return verifyTokenResult;
}

async function getPrivateKey(sessionToken: string) {
  const metisUrl: any = process.env.METIS_URL;
  console.log("metisUrl=", metisUrl);
  console.log("getPrivateKey=====");
  const getPrivateKeyResult = await httpClient.sendTrans(
    metisUrl,
    "api/v1/service/wallet/export_key_without_check",
    null,
    "post",
    sessionToken,
  );
  return getPrivateKeyResult;
}

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
        ethValue: transData["value"] + "",
        contractAddress: transData["to"],
        encodedFunction: transData["encodedFunction"],
      },
    ],
  });
  return bundle;
}

export default function AggregatorProxyCallback(
  upstreamAggregatorUrl: string,
  verificationGatewayUrl: string,
  jsonRpcUrl: string,
  bundleTransformer: (clientBundle: Bundle) => Bundle | Promise<Bundle>,
) {
  const app = new Koa();
  app.use(cors());
  const upstreamAggregator = new Aggregator(upstreamAggregatorUrl);

  const router = new Router();

  router.post("/bundle", bodyParser(), async (ctx) => {
    console.log("bundle=====");
    try {
      const verifyTokenResult = await verifyToken(
        ctx.header["access-token"] + "",
      );
      if (verifyTokenResult.code != 200) {
        ctx.status = verifyTokenResult.code;
        ctx.body = verifyTokenResult.message;
        return;
      } else {
        if (!verifyTokenResult.data.pass) {
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
      console.log("transData=", transData);
      if (privateKey == null || privateKey == "" || privateKey == "0x") {
        const getPrivateKeyResult = await getPrivateKey(
          transData["sessionToken"],
        );

        if (getPrivateKeyResult.code != 200) {
          ctx.status = getPrivateKeyResult.code;
          ctx.body = getPrivateKeyResult.message;
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
      const nounce = await blsWallet.Nonce() + "";

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
      const verifyTokenResult = await verifyToken(
        ctx.header["access-token"] + "",
      );
      if (verifyTokenResult.code != 200) {
        ctx.status = verifyTokenResult.code;
        ctx.body = verifyTokenResult.message;
        return;
      } else {
        if (!verifyTokenResult.data.pass) {
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
      if (privateKey == null || privateKey == "") {
        const getPrivateKeyResult = await getPrivateKey(
          transData["sessionToken"],
        );

        if (getPrivateKeyResult.code != 200) {
          ctx.status = getPrivateKeyResult.code;
          ctx.body = getPrivateKeyResult.message;
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
      const nounce = await blsWallet.Nonce() + "";

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
      const verifyTokenResult = await verifyToken(
        ctx.header["access-token"] + "",
      );
      if (verifyTokenResult.code != 200) {
        ctx.status = verifyTokenResult.code;
        ctx.body = verifyTokenResult.message;
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
      const verifyTokenResult = await verifyToken(
        ctx.header["access-token"] + "",
      );
      if (verifyTokenResult.code != 200) {
        ctx.status = verifyTokenResult.code;
        ctx.body = verifyTokenResult.message;
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
    console.log("bundleReceipt=====");
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

  router.get("/status", bodyParser(), async (ctx) => {
    ctx.status = 200;
    ctx.body = "ok";
  });

  app.use(router.routes());

  return app.callback();
}
