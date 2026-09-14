const [name, delayText, totalText] = process.argv.slice(2);
const delay = Number(delayText);
const total = Number(totalText);
const RESET = "\u001b[0m";
const CYAN = "\u001b[36m";
const GREEN = "\u001b[32m";
const YELLOW = "\u001b[33m";
const MAGENTA = "\u001b[35m";
const colour = name === "API" ? CYAN : name === "WORKER" ? YELLOW : MAGENTA;
let tick = 0;

function write(message, tone = colour) {
    console.log(`${tone}${message}${RESET}`);
}

write(`${name} booting local development service`);
write(`${name} listening for changes`, GREEN);

const timer = setInterval(() => {
    tick += 1;

    if (name === "API") {
        write(`GET /v1/projects/${100 + (tick % 4)} 200 ${18 + tick}ms`);
        if (tick % 4 === 0) {
            write(JSON.stringify({ service: "api", requests: tick * 7, healthy: true }));
        }
    } else if (name === "WORKER") {
        write(`queue sync batch ${String(tick).padStart(2, "0")} complete (${tick * 3} jobs)`);
        if (tick % 5 === 0) {
            write("retry budget healthy; next poll in 2s", GREEN);
        }
    } else {
        write(`compiled module ${String(tick).padStart(2, "0")} in ${90 + tick * 4}ms`);
        if (tick % 4 === 0) {
            write("hmr update applied", GREEN);
        }
    }

    if (tick === Math.floor(total * 0.65)) {
        write("slow operation detected; continuing", YELLOW);
    }

    if (tick >= total) {
        clearInterval(timer);
        write(`${name} ready - demo stream complete`, GREEN);
    }
}, delay);
