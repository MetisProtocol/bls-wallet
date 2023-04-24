import httpClient from "./httpClient";
import config from "./config"

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

async function requestAggregator(chainId:string,limit:number=100,status:string="all") {
  const aggregatorUrl = config.getChainProperty(String(chainId)).AGGREGATOR_URL;
  const metisUrl: any = process.env.METIS_URL;
  console.log("aggregatorUrl:",aggregatorUrl)
  const bundles = await httpClient.sendTrans(
    aggregatorUrl,
    "bundlelist/"+limit+"/"+status,
    null,
    "get",
    "",
  );
  return bundles;
}

async function clearBundle(chainId:string) {
  const aggregatorUrl = config.getChainProperty(String(chainId)).AGGREGATOR_URL;
  const metisUrl: any = process.env.METIS_URL;
  const bundles = await httpClient.sendTrans(
    aggregatorUrl,
    "bundles/clear",
    null,
    "get",
    "",
  );
  return bundles;
}

async function tryaggregating(chainId:string) {
  const aggregatorUrl = config.getChainProperty(String(chainId)).AGGREGATOR_URL;
  const bundles = await httpClient.sendTrans(
    aggregatorUrl,
    "tryaggregating",
    null,
    "get",
    "",
  );
  return bundles;
}

async function getBundle(chainId:string,hash:string) {
  const aggregatorUrl = config.getChainProperty(String(chainId)).AGGREGATOR_URL;
  const bundles = await httpClient.sendTrans(
    aggregatorUrl,
    "getbundle/"+hash,
    null,
    "get",
    "",
  );
  return bundles;
}

export default {
  verifyToken,
  getPrivateKey,
  requestAggregator,
  clearBundle,
  tryaggregating,
  getBundle
}