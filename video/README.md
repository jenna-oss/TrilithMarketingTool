# The Buy Box Video Pipeline

Automated topic-to-video pipeline: give it a topic (a short description or a
source article URL) and it produces a finished, voiced, vertical (1080x1920)
video for the account's real-estate/finance content series.

See [`PIPELINE_SPEC.html`](./PIPELINE_SPEC.html) for the full design spec
(stages, the hook-selection logic, the asset QA rubric).

## What's in this repo

- `remotion/` -- the Remotion project. `pipeline_workflow.mjs` is the actual
  orchestration script (run via Claude Code's Workflow tool).
  - `src/` holds one `.tsx` file per generated video, each designed from
    scratch.
  - `src/brand.ts` is The Buy Box brand, from its brand guide: colors, fonts
    (Archivo and Inter), logo, the Reels safe zone and text-size floors.
  - `src/Captions.tsx` is the word-synced caption overlay every video carries.
  - `brand-lint.mjs` checks a video against the brand's rules, never its
    layout.
  - The older `components/`, `tokens.ts` and `fonts.ts` are the pre-brand
    look, kept for the videos made with them.
  - `voiceover_TEMPLATE.py` + `numeric_tts.py` are the canonical
    timestamp-driven ElevenLabs voiceover every video uses. It also writes the
    captions' word timings.
- `hook_templates_1000.json` -- the ~980-template hook library (Educational,
  Storytelling, Authority, Myth Busting, Comparison, Day in the Life,
  Random) the Script stage selects and fills in from.

This lives inside the marketing tool rather than in its own repository, so the
plan and the thing that renders it are one deploy. Locking a plan on the Plan
page is what makes it renderable; nothing is copied between repos.

## Setup

```bash
cd video/remotion
npm install
pip install -r ../requirements.txt
```

Requires `ffmpeg` on PATH (frame extraction for asset QA, audio muxing).

## Environment

`ELEVENLABS_API_KEY` must be set -- as a repository secret for CI, or in a
local `video/.env` for local runs (gitignored, never committed).

CI also uses `ANTHROPIC_API` (the CLI reads `ANTHROPIC_API_KEY`; the workflow
maps between them), plus `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to read
the locked plan.

## Running a video

Normally you do not: `.github/workflows/render-videos.yml` runs it on a runner,
reading briefs straight from `kb.planning_sessions`. Lock a plan, then:

```bash
gh workflow run render-videos.yml -f only=1
```

By hand, via Claude Code's Workflow tool:

```
Workflow({
  scriptPath: "video/remotion/pipeline_workflow.mjs",
  args: { root: "<absolute path to video/>", topic: "<a topic or source URL>" }
})
```

`topic` can also be an object with the Plan page's fields (`topic`, `angle`,
`hook`, `evidence`, `product`, `audience`, `source_ids`). When there is a
`hook`, it is beat 1 of the script word for word, enforced in the script rather
than asked for; the template library is only used for briefs without one.

`args.root` is required away from the original Windows working copy: a workflow
script is sandboxed, with no `process.env` and no filesystem, so it cannot
discover where it lives and has to be told.

In CI neither goes through args. The workflow writes the locked brief and the
checkout path into a copy of the script, `video/remotion/.run/pipeline.mjs`,
and runs that. Args are typed out by the model driving the run, and a brief
passed that way once reached the Research stage as `[object Object]`.

The workflow runs Research -> Script -> Visual Plan -> Assets -> Assembly ->
Voiceover and returns the finished video's path. It does not auto-publish
anything -- the output is meant for human review before it goes anywhere
public.

## Editing a finished video

On the Output page, open a video and type the change under "Request a change".
The Worker queues it in `kb.video_edits` and starts `render-videos.yml` with
`edit_id` set, so the run covers that one video.

- **Its source was kept.** Every render packs its scenes, narration script,
  recorded narration, clips and captions with `pack-source.sh` into the
  private `video-sources` bucket. The run restores them and an agent, prompted
  by `edit-prompt.mjs`, changes only what was asked. It records the narration
  again only if the words change, then renders and muxes as usual.
- **Its source wasn't kept** (videos made before this existed). The pipeline
  re-makes the video from its brief, with the change added as `revision`.

Either way the result is judged by `find-output.sh` like any render, and stored
as a new version of the same slot. It replaces the card and lands in Ready to
review. The request box is open, so the limits live in the database: 3 to 600
characters, one edit at a time per video, ten a day. The edit agent gets no web,
Workflow or Agent tools.
