const { runPaginated } = require("../src");

const node = process.execPath;
const command = (name, delay) =>
  `${node} -e "let tick = 0; const timer = setInterval(() => { console.log('${name} tick ' + ++tick); if (tick === 12) { clearInterval(timer); } }, ${delay})"`;

runPaginated(
  [
    { name: "API", command: command("api", 250) },
    { name: "WORKER", command: command("worker", 425) },
    { name: "WEB", command: command("web", 650) },
  ],
  {
    formatJsonLogs: false,
    maxBufferLines: 200,
  },
).catch(() => {
  process.exitCode = 1;
});
