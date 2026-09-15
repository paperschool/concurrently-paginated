const { runPaginated } = require("../src");
const path = require("node:path");

const node = process.execPath;
const worker = path.join(__dirname, "demo-worker.js");
const command = (name, delay, total) =>
    `${node} ${JSON.stringify(worker)} ${JSON.stringify(name)} ${delay} ${total}`;

runPaginated(
    [
        { name: "API", command: command("API", 220, 360) },
        { name: "WORKER", command: command("WORKER", 340, 280) },
        { name: "WEB", command: command("WEB", 470, 220) },
        { name: "DATABASE", command: command("DATABASE", 560, 180) },
        { name: "AUTH", command: command("AUTH", 680, 150) },
    ],
    {
        formatJsonLogs: false,
        maxBufferLines: 200,
    },
).catch(() => {
    process.exitCode = 1;
});
