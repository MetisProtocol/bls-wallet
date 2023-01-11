/**
 * <p>
 * middleware http client
 * </p>
 */


import axios from 'axios';


async function sendTrans(apiHost: string, method: string, data: any, httpMethod: string = 'post'){
    const headers = {
        'Content-Type': 'application/json'
    };
    let res;
    if (httpMethod === 'post') {
        res = await axios.post(apiHost + "/" + method, data, { headers });
    }else {
        res = await axios.get(apiHost + "/" + method + "?" + data, { headers });
    }
    if (res.status === 200) {
        return res.data;
    }
    return;
}

function sleep(time:number) {
    return new Promise((resolve) => {
        setInterval(resolve, time);
    });
}

export default {
    sendTrans,
    sleep
}
