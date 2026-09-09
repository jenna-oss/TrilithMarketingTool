# Trilith Video Pipeline

Automated topic-to-video pipeline: give it a topic (a short description or a
source article URL) and it produces a finished, voiced, vertical (1080x1920)
video for the account's real-estate/finance content series.

See [`PIPELINE_SPEC.html`](./PIPELINE_SPEC.html) for the full design spec
(stages, the hook-selection logic, the asset QA rubric).

## What's in this repo

- `remotion/` -- the Remotion project. `pipeline_workflow.mjs` is the actual
  orchestration script (run via Claude Code's Workflow tool); `src/` holds
  the shared component library (`Card`, `GiantStat`, `BuildList`,
  `DocumentCard`, `BounceText`) and one `.tsx` file per generated video;
  `voiceover_TEMPLATE.py` + `numeric_tts.py` are the canonical
  timestamp-driven ElevenLabs voiceover approach every video uses.
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

`args.root` is required away from the original Windows working copy: a workflow
script is sandboxed, with no `process.env` and no filesystem, so it cannot
discover where it lives and has to be told.

The workflow runs Research -> Script -> Visual Plan -> Assets -> Assembly ->
Voiceover and returns the finished video's path. It does not auto-publish
anything -- the output is meant for human review before it goes anywhere
public.
