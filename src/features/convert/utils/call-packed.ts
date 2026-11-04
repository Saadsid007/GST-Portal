import {
  runPackedConvertAction,
  type PackedConvertActions,
} from "@/features/convert/actions/packed.actions";
import {
  FILE_MARKER,
  isStaleDeploymentError,
  MAX_UPLOAD_BYTES,
  STALE_DEPLOYMENT_MESSAGE,
  uploadTooLargeMessage,
} from "@/features/convert/utils/upload-transport";

/**
 * Browser side of the upload transport (see upload-transport.ts).
 *
 * `callPacked("revalidateAll", rows, gstin, period)` calls the convert action
 * of that name with gzipped arguments and reads its gzipped result. Files
 * anywhere in the arguments are gzipped on their own and sent alongside.
 */
const gzipped = new WeakMap<Blob, Blob>();

async function gzip(blob: Blob): Promise<Blob> {
  const stream = blob.stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

async function gzipFile(file: Blob): Promise<Blob> {
  const cached = gzipped.get(file);
  if (cached) return cached;
  const result = await gzip(file);
  // The review and processing steps send the same files; compress them once.
  gzipped.set(file, result);
  return result;
}

async function gunzipJson(bytes: Uint8Array): Promise<unknown> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

type Action = PackedConvertActions;

export async function callPacked<K extends keyof Action>(
  name: K,
  ...args: Parameters<Action[K]>
): Promise<Awaited<ReturnType<Action[K]>>> {
  const originals: { blob: Blob; name: string }[] = [];
  const json = JSON.stringify(args, (_key, value: unknown) => {
    if (value instanceof Blob) {
      originals.push({ blob: value, name: value instanceof File ? value.name : "upload" });
      return { [FILE_MARKER]: originals.length - 1 };
    }
    return value;
  });

  const [payload, ...files] = await Promise.all([
    gzip(new Blob([json])),
    ...originals.map((o) => gzipFile(o.blob)),
  ]);

  const total = payload!.size + files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_UPLOAD_BYTES) {
    const big = originals
      .map((o, i) => ({ name: o.name, size: files[i]!.size }))
      .sort((a, b) => b.size - a.size);
    throw new Error(
      uploadTooLargeMessage(total, big.length > 0 ? [big[0]!.name] : ["This return"])
    );
  }

  let result: Uint8Array;
  try {
    result = await runPackedConvertAction(name, payload!, files);
  } catch (err) {
    // The tab was opened before a deploy. Say so plainly and load the
    // current version, instead of leaving the seller on an error that no
    // retry can fix.
    if (err instanceof Error && isStaleDeploymentError(err.message)) {
      setTimeout(() => window.location.reload(), 2500);
      throw new Error(STALE_DEPLOYMENT_MESSAGE);
    }
    throw err;
  }
  return (await gunzipJson(result)) as Awaited<ReturnType<Action[K]>>;
}
