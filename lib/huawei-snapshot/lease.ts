import { open, readFile, stat, rm } from "node:fs/promises";
const processStarted = async (pid: number) => {
  try {
    const body = await readFile(`/proc/${pid}/stat`, "utf8");
    return body.slice(body.lastIndexOf(")") + 2).split(" ")[19];
  } catch {
    return null;
  }
};
export async function acquireSyncLease(path: string) {
  async function create() {
    const handle = await open(path, "wx");
    await handle.writeFile(
      JSON.stringify({
        pid: process.pid,
        started: await processStarted(process.pid),
        at: new Date().toISOString(),
      }),
    );
    return handle;
  }
  try {
    return await create();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const info = await stat(path);
  let owner: { pid: number; started: string } | null = null;
  try {
    owner = JSON.parse(await readFile(path, "utf8"));
  } catch {}
  if (
    (owner && (await processStarted(owner.pid)) === owner.started) ||
    (!owner && Date.now() - info.mtimeMs < 300000)
  )
    throw new Error("A synchronization is already running");
  // Recover a worker killed before it could release its lease; the scheduler needs no manual cleanup.
  await rm(path);
  return create();
}
