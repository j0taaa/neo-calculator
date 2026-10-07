import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import type { ScopeSnapshot, SnapshotRelease } from "./types";
import { scopeKey } from "./types";

export const digest = (body: string | Buffer) =>
  createHash("sha256").update(body).digest("hex");
export const snapshotDirectory = () =>
  process.env.HUAWEI_SNAPSHOT_DIR ?? "data/huawei-snapshot";
const validHash = (value: string) => /^[a-f0-9]{64}$/.test(value);
export class SnapshotStore {
  constructor(readonly root = snapshotDirectory()) {}
  async blob(body: string, extension = "") {
    const hash = digest(body);
    await mkdir(join(this.root, "blobs"), { recursive: true });
    await writeFile(join(this.root, "blobs", hash + extension), body, {
      flag: "wx",
    }).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
    return hash;
  }
  async read(hash: string, extension = "") {
    if (!validHash(hash)) throw new Error("Invalid snapshot identifier");
    const body = await readFile(
      join(this.root, "blobs", hash + extension),
      "utf8",
    );
    if (digest(body) !== hash)
      throw new Error("Synchronized snapshot failed its integrity check");
    return body;
  }
  async writeScope(scope: ScopeSnapshot) {
    const configBlob = await this.blob(scope.config);
    const productsBlob = await this.blob(JSON.stringify(scope.products));
    const proofBlob = scope.proof
      ? await this.blob(JSON.stringify(scope.proof))
      : undefined;
    return this.blob(
      JSON.stringify({
        ...scope,
        config: undefined,
        products: undefined,
        proof: undefined,
        configBlob,
        productsBlob,
        proofBlob,
      }),
      ".json",
    );
  }
  async active(): Promise<SnapshotRelease> {
    let id: string;
    try {
      id = (await readFile(join(this.root, "active"), "utf8")).trim();
    } catch {
      throw new Error("The daily calculator snapshot is not available yet");
    }
    return this.release(id);
  }
  async release(id: string): Promise<SnapshotRelease> {
    const release = JSON.parse(await this.read(id, ".json")) as SnapshotRelease;
    if (release.version !== 1)
      throw new Error("Unsupported calculator snapshot version");
    return { ...release, id };
  }
  async scope(
    release: SnapshotRelease,
    service: string,
    region: string,
    includeProof = true,
  ): Promise<ScopeSnapshot> {
    const hash = release.scopes[scopeKey(service, region)];
    if (!hash)
      throw new Error(
        "This service and region have no validated local snapshot",
      );
    const record = JSON.parse(await this.read(hash, ".json"));
    const scope: ScopeSnapshot = record.productsBlob
      ? {
          ...record,
          config: await this.read(record.configBlob),
          products: JSON.parse(await this.read(record.productsBlob)),
          ...(includeProof && record.proofBlob
            ? { proof: JSON.parse(await this.read(record.proofBlob)) }
            : {}),
        }
      : record;
    if (!includeProof) delete scope.proof;
    if (
      scope.service !== service ||
      scope.region !== region ||
      !scope.checks ||
      !scope.verifiedAt
    )
      throw new Error("Invalid synchronized scope");
    return scope;
  }
  async publish(candidate: SnapshotRelease) {
    if (!Object.keys(candidate.scopes).length)
      throw new Error(
        "An empty snapshot cannot replace the working calculator",
      );
    for (const key of Object.keys(candidate.scopes)) {
      const [service, region] = key.split("/");
      await this.scope(candidate, service, region);
    }
    for (const asset of Object.values(candidate.assets))
      await this.read(asset.hash);
    const id = await this.blob(
      JSON.stringify({ ...candidate, id: "" }),
      ".json",
    );
    // The application sees either the previous complete release or the new complete release.
    const pending = join(this.root, "active." + randomUUID());
    await writeFile(pending, id);
    await rename(pending, join(this.root, "active"));
    return id;
  }
}
