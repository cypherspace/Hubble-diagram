// VizieR TAP wrapper. Lifted directly from h-r-diagram's gaia.ts,
// which has been hardened against transient 503 / 400 / parser
// errors. The retry/backoff logic ports verbatim — VizieR's TAP
// service hiccups in the same ways for SH0ES queries.

const TAP_URL = "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync";

export class VizierError extends Error {
  public override readonly cause?: unknown;
  public transient = false;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "VizierError";
    this.cause = cause;
  }
}

export async function runAdql(
  adql: string,
  signal?: AbortSignal,
): Promise<string> {
  const MAX_ATTEMPTS = 3;
  let lastErr: VizierError | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await runAdqlOnce(adql, signal);
    } catch (e) {
      if (signal?.aborted) throw e;
      if (e instanceof VizierError && e.transient && attempt < MAX_ATTEMPTS) {
        lastErr = e;
        await sleep(1000 + 1500 * (attempt - 1), signal);
        continue;
      }
      throw e;
    }
  }
  throw (
    lastErr ??
    new VizierError(
      "VizieR isn't responding cleanly right now. Please try again in a moment.",
    )
  );
}

async function runAdqlOnce(
  adql: string,
  signal?: AbortSignal,
): Promise<string> {
  const params = new URLSearchParams({
    REQUEST: "doQuery",
    LANG: "ADQL",
    FORMAT: "csv",
    QUERY: adql,
  });
  let res: Response;
  try {
    res = await fetch(TAP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal,
    });
  } catch (e) {
    throw new VizierError(
      "Network error reaching VizieR. If this page is opened from " +
        "file://, the browser blocks cross-origin fetches. Serve over " +
        "http(s) (e.g. `npx serve dist`) or embed it in a website.",
      e,
    );
  }
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 503 || /service too busy/i.test(text)) {
      const err = new VizierError(
        "VizieR is busy right now. Please try again in a moment.",
      );
      err.transient = true;
      throw err;
    }
    if (
      res.status === 400 &&
      /unresolved identifier|NullPointerException|Unable to check/i.test(text)
    ) {
      const err = new VizierError(
        "VizieR couldn't validate the query. Retrying…",
      );
      err.transient = true;
      throw err;
    }
    const m = text.match(
      /QUERY_STATUS"\s+value="ERROR">\s*([\s\S]*?)\s*<\/INFO>/,
    );
    const detail = m?.[1] ?? text.slice(0, 400);
    throw new VizierError(`VizieR returned HTTP ${res.status}. ${detail}`);
  }
  return text;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

// Generic CSV parser — same shape as gaia.ts, but exposed for the
// SH0ES Cepheid table and any future VizieR table loaders.
export interface CsvRow {
  [column: string]: string;
}

export function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  const rows: CsvRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]).map((c) => c.replace(/^"|"$/g, ""));
    if (cells.length < headers.length) continue;
    const row: CsvRow = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = cells[i] ?? "";
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      cur += c;
    } else if (c === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

export function num(s: string | undefined): number | null {
  if (s == null || s === "" || s.toLowerCase() === "nan" || s === "null") {
    return null;
  }
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}
