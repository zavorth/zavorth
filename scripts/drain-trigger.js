const http = require("http");

const epoch = process.argv[2];
if (!epoch) {
  console.error("[Drain Trigger] Usage: node drain-trigger.js <epoch>");
  process.exit(1);
}

const port = process.env.PORT || 33333;
const data = JSON.stringify({ epoch: parseInt(epoch, 10) });

const req = http.request({
  hostname: "127.0.0.1",
  port: port,
  path: "/api/infra/drain",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data),
  }
}, (res) => {
  console.log(`[Drain Trigger] Status: ${res.statusCode}`);
  let responseData = "";
  res.on("data", (chunk) => {
    responseData += chunk;
  });
  res.on("end", () => {
    console.log(`[Drain Trigger] Response: ${responseData}`);
    if (res.statusCode === 200) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
});

req.on("error", (error) => {
  console.error("[Drain Trigger] Error sending request:", error.message);
  process.exit(1);
});

req.write(data);
req.end();
