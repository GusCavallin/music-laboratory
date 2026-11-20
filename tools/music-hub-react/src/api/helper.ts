/**
 * The Python helper (tools/music-hub-core/helper.py): it streams songs, sets ratings in the running iTunes, writes playlist files and rebuilds data.js.
 * Every function takes the fetch to use, so tests can stand in for the helper.
 */
export type Fetch = typeof fetch;

const JSON_HEADERS = { "Content-Type": "application/json" };

/** The address that streams a song. Files only the helper can reach are asked for by path; the helper serves only paths listed in data.js. */
export const audioUrl = (path: string): string => `/audio?p=${encodeURIComponent(path)}`;

/**
 * What a helper answers to /ping: this page's own (server.py here, port 9223), or the current page's (tools/music-hub), which does the same work
 * and is what the dev server reaches if MUSICLAB_HELPER points to it.
 */
export const HELPER_NAMES: readonly string[] = ["music-hub-react", "music-library-search"];

/** Is the helper there? It answers /ping with its name (so a second launch can recognise a running one). */
export async function ping(fetcher: Fetch = fetch): Promise<boolean> {
  try {
    const r = await fetcher("/ping", { cache: "no-store" });
    return r.ok && HELPER_NAMES.includes((await r.text()).trim());
  } catch {
    return false;
  }
}

/**
 * The version of the code that is running, from the VERSION file (read by the helper each time). data.js only has the version it was built with,
 * which is older until the next Refresh. "" means no release yet; null means the helper can't be reached.
 */
export async function loadVersion(fetcher: Fetch = fetch): Promise<string | null> {
  try {
    const r = await fetcher("/version", { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { version?: unknown };
    return typeof j.version === "string" ? j.version : null;
  } catch {
    return null;
  }
}

export interface RateRequest {
  path: string;
  name: string;
  /** 0 to 5; 0 clears the rating */
  stars: number;
  /** a "[To Rate]" playlist the song is being rated from: the helper also takes it off that playlist */
  from_playlist: string;
}

export type RateResult =
  | { ok: true; stars: number; removed: boolean }
  | { ok: false; error: string };

/** Sets one song's star rating in iTunes itself. Never throws: a helper that can't be reached is a result like any other. */
export async function rateSong(req: RateRequest, fetcher: Fetch = fetch): Promise<RateResult> {
  try {
    const r = await fetcher("/rate", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(req) });
    const j = (await r.json()) as { ok?: boolean; stars?: number; removed?: boolean; error?: string };
    return j.ok ? { ok: true, stars: Number(j.stars ?? req.stars), removed: !!j.removed } : { ok: false, error: j.error || `${r.status}` };
  } catch {
    return { ok: false, error: "Can't reach the helper" };
  }
}

export interface PlaylistSong {
  path: string;
  name: string;
  artist: string;
  secs: number;
}

export type PlaylistResult =
  | { ok: true; file: string; count: number }
  /** `exists`: the name is taken, either by a file still waiting to be imported ("pending") or by one already imported */
  | { ok: false; error: string; exists?: "pending" | "imported" };

/** Writes "[Gen] <name>.m3u8" in the playlists folder. Nothing is touched in iTunes: the user imports the file. */
export async function savePlaylist(
  req: { name: string; songs: readonly PlaylistSong[]; overwrite: boolean },
  fetcher: Fetch = fetch,
): Promise<PlaylistResult> {
  try {
    const r = await fetcher("/playlist", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(req) });
    const j = (await r.json()) as { ok?: boolean; file?: string; count?: number; error?: string; exists?: "pending" | "imported" };
    if (j.ok) return { ok: true, file: String(j.file), count: Number(j.count) };
    return { ok: false, error: j.error || `${r.status}`, ...(j.exists ? { exists: j.exists } : {}) };
  } catch {
    return { ok: false, error: "Couldn't reach the helper, nothing saved" };
  }
}

export type RebuildResult = { ok: true } | { ok: false; error: string };

/** Asks the helper to rebuild data.js from the iTunes library file. */
export async function rebuild(fetcher: Fetch = fetch): Promise<RebuildResult> {
  try {
    const r = await fetcher("/rebuild", { method: "POST" });
    const j = (await r.json()) as { ok?: boolean; error?: string; output?: string };
    return j.ok ? { ok: true } : { ok: false, error: j.error || j.output || String(r.status) };
  } catch {
    return { ok: false, error: "Can't reach the helper (is its window still open?)" };
  }
}

export interface PresetsResult {
  presets: unknown;
}

/** The saved views kept by the helper (presets.json), or null when it cannot be reached. */
export async function loadPresets(fetcher: Fetch = fetch): Promise<unknown | null> {
  try {
    const r = await fetcher("/presets", { cache: "no-store" });
    if (!r.ok) return null;
    return ((await r.json()) as PresetsResult).presets ?? [];
  } catch {
    return null;
  }
}

/** Writes the whole list of saved views to the helper (it checks it and writes the file in one go). */
export async function savePresetsToHelper(presets: readonly unknown[], fetcher: Fetch = fetch): Promise<boolean> {
  try {
    const r = await fetcher("/presets", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ presets }) });
    return r.ok;
  } catch {
    return false;
  }
}
