/* ---------------------------------------------------------------------------
 * Where source material comes from: a folder of files, article URLs, and
 * YouTube captions.
 *
 * Each fetcher returns the same envelope — { document_type, title, source,
 * source_url, published_at, source_key, raw_content, metadata } — so the ingest
 * step does not care which route a document arrived by.
 * ------------------------------------------------------------------------ */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, basename, relative, sep } from 'node:path';

import { decode, htmlToText, articleScope, metaFromHtml, isoOrNull } from './kb-lib.mjs';

const UA = 'Mozilla/5.0 (compatible; TrilithKnowledgeBot/1.0; +https://trilithfunding.com)';

export const DOCUMENT_TYPES = [
  'transcript', 'research', 'article', 'report', 'recording', 'interview', 'other',
];

/* --- files --------------------------------------------------------------- */

const EXT_TYPE = {
  '.vtt': 'transcript',
  '.srt': 'transcript',
};

/* Front matter is optional and deliberately forgiving: three dashes, key: value
 * lines, three dashes. Anything it does not understand is left in the body
 * rather than discarded, because silently eating content is worse than an
 * unrecognised key. */
function frontMatter(text) {
  const m = String(text).match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: text };

  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: text.slice(m[0].length) };
}

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile() && !e.name.startsWith('.')) out.push(p);
  }
  return out;
}

async function extractFile(path, ext) {
  if (ext === '.pdf') {
    /* pdf and docx need a parser, and the repo otherwise installs nothing but
     * Playwright. Rather than make every clone carry them, they are imported on
     * demand and their absence is reported as an actionable message instead of
     * a stack trace. */
    let pdfParse;
    try {
      ({ default: pdfParse } = await import('pdf-parse'));
    } catch {
      throw new Error('PDF support needs "pdf-parse": run `npm install pdf-parse`, or convert the file to .txt/.md.');
    }
    const parsed = await pdfParse(await readFile(path));
    return { text: parsed.text, meta: { pages: parsed.numpages } };
  }

  if (ext === '.docx') {
    let mammoth;
    try {
      mammoth = await import('mammoth');
    } catch {
      throw new Error('DOCX support needs "mammoth": run `npm install mammoth`, or convert the file to .txt/.md.');
    }
    const { value } = await mammoth.convertToHtml({ path });
    return { text: htmlToText(value), meta: {} };
  }

  const raw = await readFile(path, 'utf8');

  if (ext === '.html' || ext === '.htm') {
    return { text: htmlToText(articleScope(raw)), meta: metaFromHtml(raw) };
  }

  if (ext === '.json') {
    /* A JSON transcript export. Common shapes all reduce to a list of cues. */
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return { text: raw, meta: {} }; }
    const rows = Array.isArray(parsed) ? parsed : parsed.segments || parsed.results || parsed.cues || [];
    if (Array.isArray(rows) && rows.length && typeof rows[0] === 'object') {
      const text = rows
        .map((r) => {
          const who = r.speaker || r.speaker_label || null;
          const said = r.text || r.transcript || r.utterance || '';
          return who ? `${who}: ${said}` : said;
        })
        .filter(Boolean)
        .join('\n');
      return { text, meta: { cue_count: rows.length } };
    }
    return { text: raw, meta: {} };
  }

  return { text: raw, meta: {} };
}

/* Files under kb/files/<type>/... take their document_type from the folder.
 * That keeps the common case free of front matter: drop a podcast transcript in
 * kb/files/transcript/ and it is a transcript. */
export async function readFileSources(root) {
  const dir = join(root, 'kb', 'files');
  const paths = await walk(dir);
  const docs = [];
  const failures = [];

  for (const path of paths) {
    const ext = extname(path).toLowerCase();
    const rel = relative(root, path).split(sep).join('/');

    try {
      const { text: extracted, meta: fileMeta } = await extractFile(path, ext);
      const { meta, body } = frontMatter(extracted);

      const folder = relative(dir, path).split(sep)[0]?.toLowerCase();
      const type =
        (DOCUMENT_TYPES.includes(String(meta.type).toLowerCase()) && meta.type.toLowerCase()) ||
        EXT_TYPE[ext] ||
        (DOCUMENT_TYPES.includes(folder) ? folder : null) ||
        'other';

      const content = body.trim();
      if (!content) { failures.push({ rel, why: 'file is empty' }); continue; }

      const stats = await stat(path);

      docs.push({
        document_type: type,
        title: meta.title || basename(path, ext).replace(/[-_]+/g, ' ').trim(),
        source: meta.source || null,
        source_url: meta.url || null,
        /* No stated date means no date. A file mtime is when it was copied
         * onto this machine, which is not when the research was published, and
         * presenting one as the other would corrupt every recency score. */
        published_at: isoOrNull(meta.published || meta.date),
        source_key: `file:${rel}`,
        raw_content: content,
        metadata: {
          ...fileMeta,
          ingest_route: 'file',
          file_path: rel,
          file_bytes: stats.size,
          ...(meta.topics ? { topics: meta.topics.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
          ...(meta.content_type ? { content_type: meta.content_type } : {}),
          ...(meta.research_type ? { research_type: meta.research_type } : {}),
        },
      });
    } catch (err) {
      failures.push({ rel, why: err.message });
    }
  }

  return { docs, failures };
}

/* --- articles ------------------------------------------------------------ */

export async function fetchArticle(entry) {
  const res = await fetch(entry.url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const html = await res.text();
  const meta = metaFromHtml(html);
  const text = htmlToText(articleScope(html));

  if (text.length < 200) throw new Error('extracted body was under 200 characters — probably a JS-rendered page');

  return {
    document_type: entry.document_type || 'article',
    title: entry.title || meta.title || entry.url,
    source: entry.source || meta.publisher || new URL(entry.url).hostname.replace(/^www\./, ''),
    source_url: entry.url,
    published_at: isoOrNull(entry.published_at || meta.published),
    source_key: `url:${entry.url}`,
    raw_content: text,
    metadata: {
      ingest_route: 'url',
      ...(meta.summary ? { summary: meta.summary } : {}),
      ...(entry.topics ? { topics: entry.topics } : {}),
      ...(entry.research_type ? { research_type: entry.research_type } : {}),
    },
  };
}

/* --- YouTube ------------------------------------------------------------- */

const videoId = (url) =>
  url.match(/[?&]v=([\w-]{11})/)?.[1] ||
  url.match(/youtu\.be\/([\w-]{11})/)?.[1] ||
  url.match(/\/shorts\/([\w-]{11})/)?.[1] ||
  null;

export const isYouTube = (url) => /(?:youtube\.com|youtu\.be)/i.test(url);

/* Captions are read off the watch page rather than through an API, because
 * there is no public captions API that does not require OAuth on the channel.
 * That makes this the most fragile fetcher here: YouTube changes the shape of
 * the watch page freely, and it challenges datacenter IPs the same way Meta
 * does. Failures are per-document and non-fatal for exactly that reason. */
export async function fetchYouTube(entry) {
  const id = videoId(entry.url);
  if (!id) throw new Error('could not read a video id out of the URL');

  const res = await fetch(`https://www.youtube.com/watch?v=${id}`, {
    headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
  });
  if (!res.ok) throw new Error(`watch page returned ${res.status}`);
  const html = await res.text();

  const raw = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:var|<\/script>)/);
  if (!raw) throw new Error('no player response on the watch page (likely a bot challenge)');

  let player;
  try { player = JSON.parse(raw[1]); } catch { throw new Error('player response was not parseable JSON'); }

  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (!tracks.length) throw new Error('this video has no caption tracks');

  /* Prefer a human track over an automatic one, and English over anything else,
   * but take what exists rather than failing on a Spanish-only upload. */
  const track =
    tracks.find((t) => /^en/i.test(t.languageCode) && t.kind !== 'asr') ||
    tracks.find((t) => /^en/i.test(t.languageCode)) ||
    tracks[0];

  const capRes = await fetch(`${track.baseUrl}&fmt=json3`, { headers: { 'user-agent': UA } });
  if (!capRes.ok) throw new Error(`caption fetch returned ${capRes.status}`);
  const cap = await capRes.json();

  const lines = (cap.events || [])
    .filter((e) => e.segs)
    .map((e) => {
      const text = e.segs.map((s) => s.utf8).join('').replace(/\s+/g, ' ').trim();
      if (!text) return null;
      const start = Math.round((e.tStartMs || 0) / 1000);
      const end = Math.round(((e.tStartMs || 0) + (e.dDurationMs || 0)) / 1000);
      return { start, end, text };
    })
    .filter(Boolean);

  if (!lines.length) throw new Error('caption track was empty');

  /* Re-emitted as WebVTT so it goes through exactly the same transcript parser
   * as a caption file dropped in the folder. One code path, one behaviour. */
  const hms = (s) =>
    `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.000`;

  const vtt = ['WEBVTT', '', ...lines.flatMap((l) => [`${hms(l.start)} --> ${hms(l.end)}`, l.text, ''])].join('\n');

  const details = player.videoDetails || {};
  const published =
    player.microformat?.playerMicroformatRenderer?.publishDate ||
    html.match(/"publishDate":"([^"]+)"/)?.[1] ||
    null;

  return {
    document_type: entry.document_type || 'transcript',
    title: entry.title || decode(details.title || `YouTube ${id}`),
    source: entry.source || decode(details.author || 'YouTube'),
    source_url: `https://www.youtube.com/watch?v=${id}`,
    published_at: isoOrNull(entry.published_at || published),
    source_key: `youtube:${id}`,
    raw_content: vtt,
    metadata: {
      ingest_route: 'youtube',
      video_id: id,
      channel: decode(details.author || ''),
      duration_seconds: Number(details.lengthSeconds) || null,
      caption_kind: track.kind === 'asr' ? 'automatic' : 'human',
      language: track.languageCode,
      content_type: entry.content_type || 'video',
      ...(entry.topics ? { topics: entry.topics } : {}),
    },
  };
}

/* --- the URL list -------------------------------------------------------- */

export async function readUrlSources(root) {
  let list;
  try {
    list = JSON.parse(await readFile(join(root, 'kb', 'sources.json'), 'utf8'));
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.filter((e) => e && typeof e.url === 'string' && !e.disabled);
}
