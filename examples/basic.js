const { runPaginated } = require("../src");
const path = require("node:path");

const node = process.execPath;
const worker = path.join(__dirname, "demo-worker.js");
const command = (name, delay, total) =>
    `${node} ${JSON.stringify(worker)} ${JSON.stringify(name)} ${delay} ${total}`;

runPaginated(
    [
        { name: "API", command: command("API", 220, 36) },
        { name: "WORKER", command: command("WORKER", 340, 28) },
        { name: "WEB", command: command("WEB", 470, 22) },
    ],
    {
        formatJsonLogs: false,
        maxBufferLines: 200,
    },
).catch(() => {
    process.exitCode = 1;
});
