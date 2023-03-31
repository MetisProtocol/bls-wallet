import httpClient from "./httpClient";

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

export default {
  verifyToken,
  getPrivateKey
}