// Topic-to-video pipeline. See ../PIPELINE_SPEC.html for the full spec.
//
// In CI (.github/workflows/render-videos.yml) the locked brief and the
// checkout's location are written into a copy of this file before it runs --
// see BAKED_BRIEF below -- and the Workflow tool is called with no args.
//
// By hand: Workflow({ scriptPath: "<this file>", args: { root, topic } }), where
// topic is a short description, a source URL, or an object with the Plan page's
// fields (topic, angle, hook, evidence, product, audience, source_ids).

export const meta = {
  name: 'topic-to-video',
  description: 'Generate a finished, voiced, vertical video from a topic input',
  phases: [
    { title: 'Research' },
    { title: 'Script' },
    { title: 'Visual Plan' },
    { title: 'Assets' },
    { title: 'Assembly' },
    { title: 'Voiceover' },
  ],
}

// Replaced with literals by CI. Not taken from args there: args are typed out
// by the model driving the run, and in the first batch slot 1's brief arrived
// as an object, so the Research stage was asked to research "[object Object]".
const BAKED_BRIEF = /*@BRIEF@*/ null
const BAKED_ROOT = /*@ROOT@*/ null

const ARGS = (typeof args !== 'undefined' && args) ? args : {}
const PROJECT_ROOT = BAKED_ROOT || ARGS.root || 'C:/Users/jenna/Downloads/NicheScraper/newsletter_video_pipeline'
const REMOTION_ROOT = `${PROJECT_ROOT}/remotion`
const HOOK_LIBRARY_PATH = `${PROJECT_ROOT}/hook_templates_1000.json`
const ENV_HINT = (BAKED_ROOT || ARGS.root)
  ? 'the ELEVENLABS_API_KEY environment variable (already set on this runner)'
  : `${PROJECT_ROOT}/.env (ELEVENLABS_API_KEY)`
const VOICE_ID = 'oWdwRrGpAwNn1T1p5ZQK'

const BRIEF = normaliseBrief(BAKED_BRIEF || ARGS.brief || ARGS.topic)

// Accepts a plain topic/URL string or the Plan page's slot fields, and always
// hands back the same shape, so no prompt below interpolates an object.
function normaliseBrief(b) {
  if (typeof b === 'string') b = { topic: b }
  if (!b || typeof b !== 'object') {
    throw new Error('No brief: pass args.topic (a string or an object with a topic), or run from CI')
  }
  const text = (v) => Array.isArray(v) ? v.filter(Boolean).join('; ').trim()
    : typeof v === 'string' ? v.trim()
    : v == null ? '' : String(v).trim()
  const sources = Array.isArray(b.source_ids) ? b.source_ids : Array.isArray(b.sources) ? b.sources : []
  const brief = {
    topic: text(b.topic) || text(b.title),
    goal: text(b.goal),
    angle: text(b.angle),
    hook: text(b.hook) || text(b.opening_line),
    evidence: text(b.evidence),
    product: text(b.product),
    audience: text(b.audience),
    sources: sources.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()),
  }
  if (!brief.topic) throw new Error('The brief has no topic')
  return brief
}

function briefBlock() {
  return [
    `TOPIC: ${BRIEF.topic}`,
    BRIEF.goal && `BATCH GOAL: ${BRIEF.goal}`,
    BRIEF.angle && `ANGLE: ${BRIEF.angle}`,
    BRIEF.hook && `OPENING LINE (locked, spoken to camera): ${BRIEF.hook}`,
    BRIEF.evidence && `EVIDENCE ALREADY GATHERED: ${BRIEF.evidence}`,
    BRIEF.product && `PRODUCT: ${BRIEF.product}`,
    BRIEF.audience && `AUDIENCE: ${BRIEF.audience}`,
    BRIEF.sources.length && `SOURCES:\n${BRIEF.sources.map(s => `- ${s}`).join('\n')}`,
  ].filter(Boolean).join('\n\n')
}

const COMPONENT_NAMES = [
  'Card', 'GiantStat', 'BuildList', 'DocumentCard',
  'BoldStatementFullBleed', 'TwinSplit', 'StepProcess',
  'SignalPulseClose', 'OpeningFullBleed',
]

const RESEARCH_SCHEMA = {
  type: 'object',
  required: ['slug', 'workingTitle', 'sourcedFacts', 'sourceUrls'],
  properties: {
    slug: { type: 'string', description: 'lowercase-hyphenated short identifier for this topic, e.g. "arnold-schwarzenegger"' },
    workingTitle: { type: 'string' },
    sourcedFacts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['fact', 'source'],
        properties: { fact: { type: 'string' }, source: { type: 'string' }, date: { type: 'string' } },
      },
    },
    sourceUrls: { type: 'array', items: { type: 'string' } },
    missingNumbers: { type: 'string', description: 'note any hard numbers (rates, ratios, dates) the sources do not provide -- never invent them' },
  },
}

const SCRIPT_SCHEMA = {
  type: 'object',
  required: ['hookCategory', 'hookTemplate', 'filledHook', 'beats'],
  properties: {
    hookCategory: { type: 'string', description: 'the library category, or "LOCKED" when the brief has a locked opening line' },
    hookTemplate: { type: 'string', description: 'the raw template string chosen from hook_templates_1000.json, placeholders intact -- or "(locked on the Plan page)"' },
    filledHook: { type: 'string', description: 'the template with (insert X) placeholders filled from real facts -- or the locked opening line, verbatim' },
    beats: {
      type: 'array',
      minItems: 8,
      maxItems: 13,
      items: {
        type: 'object',
        required: ['order', 'line', 'estSeconds'],
        properties: {
          order: { type: 'number' },
          line: { type: 'string', description: 'natural spoken line for this beat, short and punchy -- this is what gets narrated' },
          estSeconds: { type: 'number' },
        },
      },
    },
  },
}

const VISUAL_PLAN_SCHEMA = {
  type: 'object',
  required: ['beats'],
  properties: {
    beats: {
      type: 'array',
      items: {
        type: 'object',
        required: ['order', 'component', 'sizeTier', 'description', 'needsAsset'],
        properties: {
          order: { type: 'number' },
          component: { type: 'string', enum: COMPONENT_NAMES },
          sizeTier: { type: 'string', enum: ['giant', 'large', 'medium'] },
          description: { type: 'string', description: 'what content/graphic goes in this beat -- specific enough for the assembly step to build real props from it' },
          needsAsset: { type: 'boolean' },
          assetSearchHint: { type: 'string', description: 'if needsAsset, 2-3 keyword phrases for a Pexels VIDEO search specific to this beat\'s line' },
        },
      },
    },
  },
}

const ASSET_BEAT_SCHEMA = {
  type: 'object',
  required: ['beatOrder', 'approved'],
  properties: {
    beatOrder: { type: 'number' },
    approved: { type: 'boolean' },
    localPath: { type: 'string' },
    cropMode: { type: 'string', enum: ['cover', 'contain-white'] },
    reason: { type: 'string' },
  },
}

const ASSEMBLY_SCHEMA = {
  type: 'object',
  required: ['tsxPath', 'compositionId', 'initialRenderOk'],
  properties: {
    tsxPath: { type: 'string' },
    compositionId: { type: 'string' },
    initialRenderOk: { type: 'boolean' },
    renderError: { type: 'string' },
    sceneDurationsSeconds: { type: 'array', items: { type: 'number' }, description: 'the placeholder durationInFrames values (in seconds) used per scene, in order -- Voiceover stage needs these to compute the real ones' },
  },
}

const VOICEOVER_SCHEMA = {
  type: 'object',
  required: ['finalVideoPath', 'durationSeconds', 'muxOk'],
  properties: {
    finalVideoPath: { type: 'string' },
    durationSeconds: { type: 'number' },
    muxOk: { type: 'boolean' },
    notes: { type: 'string' },
  },
}

function componentReferenceBlock() {
  return `
Reference material -- read these before writing anything, they are the actual conventions in use:
- ${REMOTION_ROOT}/src/MayweatherVideo.tsx
- ${REMOTION_ROOT}/src/JPMorganVideo.tsx
- ${REMOTION_ROOT}/src/DSCRVideo.tsx
- ${REMOTION_ROOT}/src/ConstructionVideo.tsx
- ${REMOTION_ROOT}/src/components/Card.tsx, GiantStat.tsx, BuildList.tsx, DocumentCard.tsx, BounceText.tsx
- ${REMOTION_ROOT}/src/tokens.ts (color palette), ${REMOTION_ROOT}/src/fonts.ts (Fraunces font loading)
- ${REMOTION_ROOT}/src/Root.tsx (composition registry -- follow its exact pattern for TOTAL_S and <Composition>)
Components not yet extracted into components/ (BoldStatementFullBleed, TwinSplit-style layouts, step-process visuals,
the signal-pulse closer, opening full-bleed video/photo treatments) are currently defined locally inside each video's
own .tsx file -- follow that same convention: define new bespoke full-bleed components inline in the new video file,
copying the closest existing implementation (e.g. the signal-pulse closer from JPMorganVideo.tsx/DSCRVideo.tsx) rather
than reinventing it.`
}

phase('Research')
const research = await agent(
  `Research this brief for a short-form vertical educational video about real estate/finance.

${briefBlock()}

The brief was locked by a person on the Plan page. Research serves it: keep its topic and angle, and do
not trade them for a different story.

Read any SOURCES first, and if the TOPIC is itself a URL, fetch and read that. Then web-search to fill
gaps. Cross-check facts against 2-3 sources when possible. Extract dated, specific facts with citations
-- do not invent numbers. If the topic doesn't have hard figures (rates, ratios, dollar amounts), say so
explicitly in missingNumbers rather than making them up. Where the brief's EVIDENCE or OPENING LINE states
a figure, confirm it from a source, or say in missingNumbers that it could not be confirmed.

Also produce a lowercase-hyphenated "slug" for this topic (e.g. "arnold-schwarzenegger", "cap-rate-explainer")
-- it will be used as a file/folder name, so keep it short, no spaces, no special characters besides hyphens.`,
  { schema: RESEARCH_SCHEMA, label: 'research' }
)
log(`Researched "${research.workingTitle}" (slug: ${research.slug})`)

phase('Script')
const hookStep = BRIEF.hook
  ? `The opening line is already decided: it was locked on the Plan page. Beat 1 is exactly this line,
word for word, with no change to its wording or punctuation:

${BRIEF.hook}

Do not pick a hook from the template library and do not rewrite this line. Report hookCategory "LOCKED",
hookTemplate "(locked on the Plan page)", and filledHook as the line above. Beat 2 onward must follow on
from it.`
  : `Read the hook template library at ${HOOK_LIBRARY_PATH} (a JSON object of {category: [templates...]}).
Pick ONE category and ONE specific template from that library that fits this brief's angle. Fill its
(insert X) placeholders with real details from the facts above -- do not invent facts. Report both the
raw template (hookTemplate, placeholders intact) and the filled version (filledHook). The filledHook
should be beat 1 or very close to it.`

const script = await agent(
  `Write the script for a short-form vertical video from this brief. The brief was locked by a person on
the Plan page: the script carries its ANGLE, speaks to its AUDIENCE, and features its PRODUCT where it
names one. Do not drift to a different story.

${briefBlock()}

Working title: ${research.workingTitle}
Facts (the only source for figures and claims):
${research.sourcedFacts.map(f => `- ${f.fact} (${f.source})`).join('\n')}

${hookStep}

Then write a full beat-by-beat script: 8-13 beats, each a short natural spoken line (these get narrated
by a cloned voice, so keep them punchy -- 8-14 words per beat is typical, not full paragraphs) with an
estSeconds guess. The script should read as one connected story, not isolated facts -- reference the
Mayweather/JPMorgan/DSCR/Construction videos' scripts in ${PROJECT_ROOT}/data/script_*.json for the tone
and pacing this account uses.`,
  { schema: SCRIPT_SCHEMA, label: 'script' }
)
// Not left to the prompt alone. In the first batch every script replaced the
// locked hook with one from the template library, so the line is put in place
// here, where no agent can talk its way out of it.
if (BRIEF.hook) lockOpeningLine(script, BRIEF.hook)
log(`Hook: [${script.hookCategory}] "${script.filledHook}"`)

function lockOpeningLine(s, hook) {
  const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const at = s.beats.findIndex(b => norm(b.line) === norm(hook))
  if (at > 0) {
    s.beats.unshift(s.beats.splice(at, 1)[0])
    log(`The locked opening line was beat ${at + 1}; moved it to beat 1`)
  } else if (at < 0) {
    log(`Beat 1 was not the locked opening line; replaced "${s.beats[0].line}"`)
    // A guess only, as every estSeconds is: Voiceover times each scene to the real take.
    s.beats[0].estSeconds = Math.max(3, Math.round(hook.split(/\s+/).length / 2.8 * 10) / 10)
  }
  s.beats[0].line = hook
  s.beats.forEach((b, i) => { b.order = i + 1 })
  s.hookCategory = 'LOCKED'
  s.hookTemplate = '(locked on the Plan page)'
  s.filledHook = hook
}

phase('Visual Plan')
let visualPlan = null
for (let attempt = 0; attempt < 3; attempt++) {
  const feedback = visualPlan ? planViolations(visualPlan) : null
  const candidate = await agent(
    `${componentReferenceBlock()}

Map each beat below to ONE component from this exact list: ${COMPONENT_NAMES.join(', ')}.
Also assign a sizeTier for that beat's dominant text element: "giant" (140px+), "large" (95-140px), or "medium" (60-95px).

HARD RULES (a plan violating these will be rejected and you'll be asked again):
1. No two consecutive beats use the same component.
2. No two consecutive beats use the same sizeTier.
3. Across the whole plan, use at least 3 different components and all 3 size tiers at least once.

For each beat also decide needsAsset (true if this beat should show a real photo/video rather than a
pure graphic/text treatment) and, if true, assetSearchHint: 2-3 keyword phrases for a Pexels VIDEO search
specific to THIS beat's line (not a generic topic keyword). Aim for roughly a third of beats needing an
asset -- not every beat, and not zero.

Beats:
${script.beats.map(b => `${b.order}. (${b.estSeconds}s) ${b.line}`).join('\n')}
${feedback ? `\nYour previous attempt violated these rules, fix them: ${feedback}` : ''}`,
    { schema: VISUAL_PLAN_SCHEMA, label: `visual-plan-attempt-${attempt}` }
  )
  const violations = planViolations(candidate)
  if (!violations) { visualPlan = candidate; break }
  visualPlan = candidate
  log(`Visual plan attempt ${attempt + 1} had violations, retrying: ${violations}`)
}

function planViolations(plan) {
  const problems = []
  for (let i = 1; i < plan.beats.length; i++) {
    if (plan.beats[i].component === plan.beats[i - 1].component) {
      problems.push(`beats ${plan.beats[i - 1].order}-${plan.beats[i].order} repeat component "${plan.beats[i].component}"`)
    }
    if (plan.beats[i].sizeTier === plan.beats[i - 1].sizeTier) {
      problems.push(`beats ${plan.beats[i - 1].order}-${plan.beats[i].order} repeat sizeTier "${plan.beats[i].sizeTier}"`)
    }
  }
  return problems.length ? problems.join('; ') : null
}

phase('Assets')
const flagged = visualPlan.beats.filter(b => b.needsAsset)
log(`${flagged.length} beat(s) flagged for real photo/video assets`)
const assetResults = flagged.length
  ? await parallel(flagged.map(beat => () => agent(
      `Find and vet ONE video asset for a beat in a vertical (1080x1920) short-form video.

Beat line (this is what the footage must relate to, not just the general topic): "${script.beats.find(b => b.order === beat.order)?.line}"
Search hint: ${beat.assetSearchHint}
Topic: ${research.workingTitle}

Steps:
1. Search Pexels' VIDEO endpoint ONLY (e.g. https://www.pexels.com/search/videos/<query>/) -- never photos, never GIFs.
   Get 3-5 candidate direct .mp4 URLs (use WebFetch on the video page to find the videos.pexels.com/video-files/ direct link).
2. For each candidate in order, download it with curl (User-Agent header needed) to a temp location, then:
   a. TIER 1 (free, no judgment needed): extract 3 frames via ffmpeg (start/mid/end, e.g. -ss 0, -ss <dur/2>, -ss <dur-0.5>).
      Look at the 3 frames yourself -- if they look nearly identical (static/boring shot, nothing moving), reject this
      candidate immediately and move to the next one without further analysis.
   b. TIER 2 (your judgment on the 3 frames): decide three things --
      - relevant: would a viewer immediately connect this footage to the EXACT beat line above? Generic topic-adjacent
        stock (e.g. handshake footage for any finance beat) should FAIL this even if thematically nearby.
      - visuallyInteresting: real composition/lighting, not the generic locked-off corporate-stock look, no dead space,
        no burned-in watermark or logo.
      - verticalCropOK: would a 9:16 COVER crop (filling the frame, cropping edges) cut off or squeeze out the
        interesting content? This does NOT gate approval -- it only decides the render mode.
   c. If relevant && visuallyInteresting: this candidate is APPROVED. Move it to
      ${REMOTION_ROOT}/public/${research.slug}/beat_${beat.order}.mp4 (create the folder if needed) and stop.
      Report cropMode as "cover" if verticalCropOK else "contain-white".
   d. If relevant is false OR visuallyInteresting is false, reject and try the next candidate. Up to 4 total attempts.
3. If all attempts fail, report approved: false and do not download anything -- this beat will fall back to a
   graphic-only treatment, which is the correct outcome, not a failure to fix.

Report the beatOrder (${beat.order}), your approved verdict, the localPath if approved, cropMode if approved, and
a one-sentence reason for your final decision.`,
      { schema: ASSET_BEAT_SCHEMA, label: `asset-beat-${beat.order}`, phase: 'Assets' }
    )))
  : []

const approvedCount = assetResults.filter(Boolean).filter(r => r.approved).length
log(`${approvedCount}/${flagged.length} asset beats approved; the rest fall back to graphic-only scenes`)

phase('Assembly')
const PascalName = research.slug.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('') + 'Video'
const assembly = await agent(
  `${componentReferenceBlock()}

Write a new Remotion composition file at ${REMOTION_ROOT}/src/${PascalName}.tsx for the topic
"${research.workingTitle}" (slug: ${research.slug}).

Script (beat order, line, estimated seconds -- use estSeconds as the initial durationInFrames guess,
these WILL be corrected in the Voiceover stage, so don't agonize over exact timing now):
${JSON.stringify(script.beats, null, 2)}

Visual plan (component + size tier + description per beat):
${JSON.stringify(visualPlan.beats, null, 2)}

Approved assets (beatOrder -> local file path + crop mode; beats not listed here got no asset and should
use a pure graphic/text treatment per the visual plan's description instead):
${JSON.stringify(assetResults.filter(Boolean).filter(r => r.approved), null, 2)}

For any beat with cropMode "contain-white": render that video/image contained (object-fit: contain) on the
brand's cream background (t.BG) rather than force-cropping it, following the Card component's photo-inset
convention -- do not invent a separate white; use the shared token.

Brand and aesthetic direction -- this account's visual identity is cream + navy + brass (see tokens.ts:
BG cream, INK navy, BAR_ACCENT brass), aiming for a SOPHISTICATED, editorial feel, not a loud/sporty one.
Concretely: generous whitespace/padding, restrained motion (spring physics already in BounceText, don't
add extra shake/flash effects unless the beat specifically calls for impact), thin brass hairlines rather
than thick blocky bars, and text sizing that leans large and confident rather than merely "big" -- use the
size tiers from the visual plan as real fontSize props: giant=170-200px, large=110-150px, medium=70-100px
(pick specific values in range, vary them beat to beat within the tier too, don't reuse the exact same
number every time).

CRITICAL -- overflow safety: giant/large sizes WILL overflow the 1080px-wide frame for anything but very
short strings, and several of this codebase's text paths do NOT auto-wrap: any plain <div style={{fontSize}}>
(not BounceText), and BounceText itself when centered with no maxWidth (Card's own header only gets a
wrap-safe maxWidth when headerAlign="left" -- a centered Card header has none and WILL run off both edges
at giant sizes if the string is more than ~10-12 characters). Before finalizing any fontSize on a specific
string, sanity-check width yourself: roughly (character count) x (fontSize x 0.55) must stay under ~950px
for a full-width element, or under the component's actual maxWidth/insetW for a constrained one. If a
number or headline is long, either size it down, or wrap it (pass an explicit maxWidth to BounceText, or
prefer headerAlign="left" on Card so its built-in maxWidth applies) rather than letting it run off-frame.

Build the full <TransitionSeries> with varied transition types (slide/wipe/fade/flip/
clockWipe in different directions, no two identical transitions back-to-back).

Register the new composition in ${REMOTION_ROOT}/src/Root.tsx following its exact existing pattern
(a TOTAL_S constant summing scene seconds minus swipe overlaps, a new <Composition id="${PascalName.replace('Video','')}">).

Then render it: cd ${REMOTION_ROOT} && npx remotion render src/index.ts ${PascalName.replace('Video', '')} out/${research.slug}.mp4
Report the tsxPath, compositionId, whether the initial render succeeded, any render error text, and the
list of scene durations in seconds you used (in beat order) -- Voiceover needs these as the starting point.`,
  { schema: ASSEMBLY_SCHEMA, label: 'assembly' }
)
if (!assembly.initialRenderOk) {
  throw new Error(`Assembly render failed: ${assembly.renderError}`)
}
log(`Assembled and rendered ${assembly.compositionId} -> initial pass OK`)

phase('Voiceover')
const voiceover = await agent(
  `Generate voiceover for the video at ${REMOTION_ROOT}/out/${research.slug}.mp4 (composition
${assembly.compositionId}, source ${assembly.tsxPath}).

Copy ${REMOTION_ROOT}/voiceover_TEMPLATE.py to ${REMOTION_ROOT}/voiceover_${research.slug}.py and fill in
SLUG = "${research.slug}" and LINES with the beats below, UNCHANGED (do not rewrite them -- the template
already handles making them TTS-safe). Do not skip the template's numeric_tts.spoken_text() import/usage
or its post-generation speedup step -- both are required, not optional:
- numeric_tts.spoken_text() spells out every number/currency/year/percent in the TTS input (on-screen
  captions in the .tsx can keep the compact numeric form, e.g. "$240,000" -- this only affects what's sent
  to the voice model). Also spell out any acronyms with periods yourself if a beat has one (e.g. "D.S.C.R."),
  and avoid "--" in lines -- use commas instead.
- the template generates at natural pace then applies a uniform 1.12x speedup for a faster, more
  enthusiastic feel without per-word slurring, and already uses more expressive voice_settings
  (stability 0.2, style 0.9) than earlier one-off scripts -- do not lower these back down.

Voice ID: ${VOICE_ID}, model eleven_multilingual_v2, ElevenLabs API key from ${ENV_HINT}.
Lines, one continuous script in order:
${script.beats.map(b => `- ${b.line}`).join('\n')}

Steps:
1. Fill in and run voiceover_${research.slug}.py to get the real per-scene durations (already speedup-adjusted).
2. Apply those exact durations back into ${assembly.tsxPath} (each TransitionSeries.Sequence's s(...) call,
   in beat order) and the TOTAL_S constant in Root.tsx.
3. Re-render: npx remotion render src/index.ts ${assembly.compositionId} out/${research.slug}.mp4
4. Mux the SAME narration audio file (don't regenerate) onto the fresh render with ffmpeg (-c:v copy -map 0:v:0
   -map 1:a:0 -af apad -c:a aac -shortest) to out/${research.slug}_voice.mp4. Keep the apad: the video runs
   a couple of seconds past the last line on purpose, and a plain -shortest cuts that closing hold off.

Report the finalVideoPath, durationSeconds, whether the mux succeeded, and any notes.`,
  { schema: VOICEOVER_SCHEMA, label: 'voiceover' }
)

return {
  topic: BRIEF.topic,
  hookLocked: Boolean(BRIEF.hook),
  slug: research.slug,
  workingTitle: research.workingTitle,
  hook: script.filledHook,
  finalVideoPath: voiceover.finalVideoPath,
  durationSeconds: voiceover.durationSeconds,
  approvedAssetCount: approvedCount,
  flaggedAssetCount: flagged.length,
  notes: voiceover.notes,
}
