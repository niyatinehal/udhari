import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { createPublicClient, http, parseEventLogs, type Hex } from "viem";
import { avalancheFuji } from "viem/chains";
import { creRelayEventsAbi } from "../abi";
import { addresses, fujiRpcUrl } from "../chain";
import { env, repoRoot } from "./env";
import { read, write, type Run } from "./store";

// Runs CRE workflows with the CRE CLI simulator and `--broadcast`, so reports are really signed
// and written to the CreRelay on Fuji, then carried to Hedera by CCIP. One run at a time, since
// every run broadcasts from the same key.

const creBin =
  env("CRE_BIN") ?? path.join(os.homedir(), ".cre", "bin", process.platform === "win32" ? "cre.exe" : "cre");

// cre-compile needs the real bun binary on PATH; an npm-installed bun only puts a shim there.
const bunDir = process.env.APPDATA ? path.join(process.env.APPDATA, "npm", "node_modules", "bun", "bin") : null;

const fuji = createPublicClient({ chain: avalancheFuji, transport: http(fujiRpcUrl) });

const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;
const RESULT = /\[USER LOG\] RESULT (\{.*\})\s*$/;
const CHECK = /\[USER LOG\] (PASS|FAIL) ([^:]+): (.*)$/;
const FUJI_TX = /Fuji in (0x[0-9a-fA-F]{64})/;

type Check = { id: string; label: string; ok: boolean; detail: string };

const queue = globalThis as unknown as { creQueue?: Promise<void> };

const save = (run: Run) =>
  write((d) => {
    const i = d.runs.findIndex((r) => r.id === run.id);
    if (i >= 0) d.runs[i] = run;
    else d.runs.push(run);
  });

export const getRun = (id: string) => read().runs.find((r) => r.id === id);

/** CCIP message id for a report written to the relay, read from the Fuji receipt. */
const messageIdFor = async (txHash: Hex): Promise<Hex | null> => {
  const receipt = await fuji.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
  const relayed = parseEventLogs({ abi: creRelayEventsAbi, logs: receipt.logs, eventName: "ReportRelayed" }).find(
    (l) => l.address.toLowerCase() === addresses.creRelay.toLowerCase(),
  );
  return relayed?.args.messageId ?? null;
};

const execute = (run: Run) =>
  new Promise<void>((resolve) => {
    run.status = "running";
    run.startedAt = Date.now();
    save(run);

    const args = [
      "workflow",
      "simulate",
      run.workflow,
      "--target",
      "staging-settings",
      "--env",
      "../.env",
      "--non-interactive",
      "--trigger-index",
      "0",
      "--broadcast",
    ];
    if (run.payload !== null) args.push("--http-payload", JSON.stringify(run.payload));

    const child = spawn(creBin, args, {
      cwd: path.join(repoRoot, "cre"),
      env: { ...process.env, PATH: bunDir ? `${bunDir}${path.delimiter}${process.env.PATH}` : process.env.PATH },
      windowsHide: true,
    });

    let buffer = "";
    let lastSave = 0;
    // Workflows log each check as its own line; the result line carries the rest.
    const checks: Check[] = [];
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8").replace(ANSI, "");
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        run.logs.push(line);
        const check = line.match(CHECK);
        if (check) checks.push({ id: check[2], label: check[2], ok: check[1] === "PASS", detail: check[3] });
        const result = line.match(RESULT);
        if (result) {
          try {
            run.result = { ...JSON.parse(result[1]), ...(checks.length ? { checks } : {}) };
          } catch {
            run.logs.push("Could not parse the workflow result");
          }
        }
        const tx = line.match(FUJI_TX);
        if (tx) run.txHash = tx[1] as Hex;
      }
      if (Date.now() - lastSave > 500) {
        lastSave = Date.now();
        save(run);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    child.on("error", (err) => {
      run.logs.push(`Could not start the CRE CLI: ${err.message}`);
      run.status = "failed";
      run.endedAt = Date.now();
      save(run);
      resolve();
    });

    child.on("close", async (code) => {
      if (buffer.trim()) run.logs.push(buffer.trim());
      run.status = code === 0 ? "done" : "failed";
      if (run.txHash) {
        try {
          run.messageId = await messageIdFor(run.txHash);
        } catch (err) {
          run.logs.push(`Could not read the CCIP message id: ${(err as Error).message}`);
        }
      }
      run.endedAt = Date.now();
      save(run);
      resolve();
    });
  });

/** Queues a workflow simulation. `onDone` runs after the CLI exits and the Fuji receipt is read. */
export const startRun = (workflow: string, payload: unknown, onDone?: (run: Run) => void): Run => {
  const run: Run = {
    id: randomUUID(),
    workflow,
    payload,
    status: "queued",
    logs: [],
    result: null,
    txHash: null,
    messageId: null,
    startedAt: Date.now(),
    endedAt: null,
  };
  save(run);
  queue.creQueue = (queue.creQueue ?? Promise.resolve()).then(async () => {
    await execute(run);
    // The CLI occasionally fails to fetch account details from the CRE backend; one retry clears it.
    if (run.status === "failed" && run.logs.some((l) => l.includes("Credential validation failed"))) {
      run.logs.push("Retrying after a CRE login check failed");
      await new Promise((r) => setTimeout(r, 3_000));
      await execute(run);
    }
    try {
      onDone?.(run);
    } catch (err) {
      console.error(`onDone for run ${run.id} failed`, err);
    }
  });
  return run;
};
