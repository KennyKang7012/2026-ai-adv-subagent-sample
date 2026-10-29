// 測試用 HTTP client：每個測試檔啟動一個長駐 server，再以 node:http 呼叫 API。
// 不用 supertest——在本環境（Windows + Node 24 + better-sqlite3）觀察到
// supertest 的請求模式會偶發觸發原生崩潰（0xC0000409）。
// 注意：這是環境層級問題，換掉 supertest 只能降低機率，無法完全消除；
// --runInBand 明顯較不穩定，詳見 README 已知限制。
// 關閉 keep-alive，避免 Jest 收尾時等待連線逾時（fetch/undici 會多等約 4 秒／檔）。
import { beforeAll, afterAll } from '@jest/globals';
import http from 'node:http';
import app from '../../src/app.js';
import db from '../../src/db.js';

const agent = new http.Agent({ keepAlive: false });

let server;
let port;

beforeAll((done) => {
  server = app.listen(0, '127.0.0.1', () => {
    port = server.address().port;
    done();
  });
});

afterAll((done) => {
  // 每個測試檔結束就釋放原生 DB handle；--runInBand 時避免多個 DB 實例累積到程序結束
  server.close(() => {
    if (db.open) db.close();
    done();
  });
});

function hasHeader(headers, name) {
  return Object.keys(headers).some((key) => key.toLowerCase() === name);
}

function send(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method, headers, agent },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');

          let json;
          try {
            json = JSON.parse(text);
          } catch {
            json = undefined;
          }

          resolve({ status: res.statusCode, headers: res.headers, text, body: json });
        });
      }
    );

    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

// 回傳形狀對齊原本測試使用的 supertest response：{ status, headers, text, body }
export async function api(method, path, { body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  let payload;

  if (body !== undefined) {
    if (Buffer.isBuffer(body) || typeof body === 'string') {
      payload = body;
    } else {
      payload = JSON.stringify(body);
      if (!hasHeader(requestHeaders, 'content-type')) {
        requestHeaders['Content-Type'] = 'application/json';
      }
    }
  }

  return send(method, path, payload, requestHeaders);
}
