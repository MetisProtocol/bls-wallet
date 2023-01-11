import fetch from 'node-fetch';
import Koa from 'koa';
import cors from '@koa/cors';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import { Bundle, bundleFromDto, Aggregator } from 'bls-wallet-clients';
import reporter from 'io-ts-reporters';
import httpClient from "./httpClient";
import dotenv from 'dotenv';
dotenv.config();

import BundleDto from './BundleDto';

(globalThis as any).fetch ??= fetch;


async function verifyToken(accessToken: string){
  const metisUrl:any = process.env.METIS_URL;
  const verifyTokenResult = await httpClient.sendTrans(metisUrl, "api/v1/verify_token", "token=" + accessToken, 'get');
  // console.log('verifyTokenResult=', verifyTokenResult);
  return verifyTokenResult;
}


export default function AggregatorProxyCallback(
  upstreamAggregatorUrl: string,
  bundleTransformer: (clientBundle: Bundle) => Bundle | Promise<Bundle>,
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

    const decodeResult = BundleDto.decode(ctx.request.body);

    if ('left' in decodeResult) {
      ctx.status = 400;
      ctx.body = reporter.report(decodeResult);
      return;
    }

    const clientBundle = bundleFromDto(decodeResult.right);
    const transformedBundle = await bundleTransformer(clientBundle);

    const addResult = await upstreamAggregator.add(transformedBundle);

    ctx.status = 200;
    ctx.body = addResult;
  });

  router.post('/estimateFee', bodyParser(), async (ctx) => {
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

    const decodeResult = BundleDto.decode(ctx.request.body);

    if ('left' in decodeResult) {
      ctx.status = 400;
      ctx.body = reporter.report(decodeResult);
      return;
    }

    const clientBundle = bundleFromDto(decodeResult.right);
    const transformedBundle = await bundleTransformer(clientBundle);

    const estimateFeeResult = await upstreamAggregator.estimateFee(transformedBundle);

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
