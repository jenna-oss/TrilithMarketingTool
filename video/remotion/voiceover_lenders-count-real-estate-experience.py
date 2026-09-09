"""
CANONICAL voiceover template -- copy this file to voiceover_<slug>.py for a
new video and fill in LINES. This is the reference the pipeline workflow's
Voiceover stage is told to follow.

Same timestamp-driven approach as every video so far: generate ONE
continuous take via ElevenLabs' with-timestamps endpoint, find each line's
real start time via character alignment, then compute the Remotion scene
durations that make the VIDEO match the VOICE (video timed to voice, never
the other way around).

Two things this template adds over earlier one-off scripts:
1. Numbers are spelled out for the TTS input via numeric_tts.spoken_text()
   -- on-screen captions can keep the compact numeric form ($240,000), but
   raw digits sent to the voice model get mispronounced inconsistently.
2. Voice is generated at natural pace (so it's not slurred/rushed the way
   ElevenLabs' own speed parameter makes it), then uniformly time-stretched
   with ffmpeg's atempo AFTER generation for a faster, more energetic feel
   -- all timestamps are rescaled by the same factor so sync is unaffected.

Run from newsletter_video_pipeline/remotion/:  python voiceover_<slug>.py
Then apply the printed durationInFrames values to <Slug>Video.tsx and the
printed TOTAL_S to Root.tsx, re-render, and re-run this script -- it will
mux the same audio it already generated onto the fresh render.
"""
import base64
import json
import os
import subprocess
import urllib.request
import urllib.error
from pathlib import Path

from dotenv import load_dotenv
from numeric_tts import spoken_text

load_dotenv(Path(__file__).parent.parent / ".env")

VOICE_ID = "oWdwRrGpAwNn1T1p5ZQK"  # cloned client narrator voice
MODEL_ID = "eleven_multilingual_v2"
SWIPE = 0.35  # must match SWIPE in the video's .tsx
FPS = 30
TAIL_PAD = 2.0
SPEEDUP = 1.12  # uniform post-generation speedup -- faster/more energetic without per-word slurring

SLUG = "lenders-count-real-estate-experience"

# One continuous script, in on-screen order. Keep lines short (8-14 words) --
# these are fast cuts, not a podcast.
LINES = [
    "Completed flips, ground-up builds, rental exits, and refinances into permanent financing, that's what actually counts as experience.",
    "But lenders don't count your whole career. Most use a rolling 24 or 36 month lookback window.",
    "Deals outside that window age out, even if they're the reason you know what you're doing.",
    "And every deal you claim needs a verifiable ownership stake, on title or through the entity that held it.",
    "Here's what quietly doesn't count: wholesale assignments, GC work, passive fund investments.",
    "Owner-occupied renovations and partner deals with no entity paperwork usually get tossed out too.",
    "So what proves it? Settlement statements, recorded deeds, HUD-1s, operating agreements, permits, draw histories.",
    "Hard money lenders run this like a tier system, more documented deals unlocks better terms.",
    "Experienced investors can get up to 90% of purchase price, plus 100% of a documented rehab budget.",
    "First-timers usually put down 20 to 30% and need bigger reserves in the bank.",
    "But you're not locked out. Flip loans and ground-up construction loans exist for first-timers too.",
    "And DSCR loans barely care about your track record, the property's cash flow does the talking.",
    "So before your next deal, ask: is this documented in a way a lender can actually verify?",
]


def run(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr[-2000:])
        raise SystemExit(f"Command failed: {cmd}")


def duration_of(path):
    out = subprocess.run(
        f'ffprobe -v error -show_entries format=duration -of csv=p=0 "{path}"',
        shell=True, capture_output=True, text=True,
    ).stdout.strip()
    return float(out)


def tts_with_timestamps(text: str):
    key = os.environ["ELEVENLABS_API_KEY"]
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}/with-timestamps"
    body = json.dumps({
        "text": text,
        "model_id": MODEL_ID,
        # lower stability + higher style = more expressive/enthusiastic delivery
        "voice_settings": {"stability": 0.2, "similarity_boost": 0.8, "style": 0.9, "use_speaker_boost": True},
    }).encode("utf-8")
    req = urllib.request.Request(
        url, data=body,
        headers={"xi-api-key": key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"ElevenLabs TTS failed: {e.code} {e.read().decode()}")


def main():
    base = Path(__file__).parent  # remotion/
    voice_dir = base / f"_voiceover_{SLUG}"
    voice_dir.mkdir(exist_ok=True)

    raw_path = voice_dir / "narration_raw.mp3"      # natural pace, straight from ElevenLabs
    audio_path = voice_dir / "narration.mp3"         # final, sped-up track actually muxed onto the video

    if audio_path.exists():
        print(f"Reusing existing narration at {audio_path} (delete it + narration_raw.mp3 to regenerate).")
        total_dur = duration_of(audio_path)
        align = json.loads((voice_dir / "alignment.json").read_text())
        script_text = (voice_dir / "script.txt").read_text()
    else:
        script_text = " ".join(spoken_text(line) for line in LINES)
        print("Generating one continuous narration with timestamps (ElevenLabs, cloned client voice)...")
        result = tts_with_timestamps(script_text)
        raw_path.write_bytes(base64.b64decode(result["audio_base64"]))
        align = result["alignment"]
        (voice_dir / "alignment.json").write_text(json.dumps(align))
        (voice_dir / "script.txt").write_text(script_text)

        # rescale every character timestamp by the same speedup factor, then
        # actually stretch the audio -- sync stays correct against the faster track
        align["character_start_times_seconds"] = [t / SPEEDUP for t in align["character_start_times_seconds"]]
        if "character_end_times_seconds" in align:
            align["character_end_times_seconds"] = [t / SPEEDUP for t in align["character_end_times_seconds"]]
        (voice_dir / "alignment.json").write_text(json.dumps(align))

        run(f'ffmpeg -y -i "{raw_path}" -filter:a "atempo={SPEEDUP}" -ar 44100 "{audio_path}"')
        total_dur = duration_of(audio_path)

    print(f"  {total_dur:.2f}s of audio (post-speedup, {SPEEDUP}x)\n")

    starts = align["character_start_times_seconds"]
    search_from = 0
    line_starts = []
    spoken_lines = [spoken_text(l) for l in LINES]
    for line in spoken_lines:
        idx = script_text.index(line, search_from)
        line_starts.append(starts[idx])
        search_from = idx + len(line)

    print("Per-line actual start times in the generated audio:")
    for line, st in zip(LINES, line_starts):
        print(f"  {st:6.2f}s  \"{line[:60]}\"")

    durations = []
    for i in range(len(line_starts) - 1):
        durations.append(round(line_starts[i + 1] - line_starts[i] + SWIPE, 2))
    durations.append(round(total_dur - line_starts[-1] + TAIL_PAD, 2))

    print(f"\nScene durationInFrames to use in the .tsx (video timed to this voice take):")
    for i, d in enumerate(durations):
        print(f"  scene {i:02d}: s({d})  -> {round(d * FPS)} frames")

    total_s = sum(durations) - (len(durations) - 1) * SWIPE
    print(f"\nTOTAL_S for Root.tsx: {' + '.join(str(d) for d in durations)} - {len(durations)-1} * {SWIPE} = {total_s:.2f}")

    video_path = base / "out" / f"{SLUG}.mp4"
    final_path = base / "out" / f"{SLUG}_voice.mp4"
    if video_path.exists():
        cur_video_dur = duration_of(video_path)
        if abs(cur_video_dur - total_s) < 0.5:
            run(
                f'ffmpeg -y -i "{video_path}" -i "{audio_path}" '
                f'-c:v copy -map 0:v:0 -map 1:a:0 -c:a aac -shortest "{final_path}"'
            )
            print(f"\nVideo duration matches the voice take -- muxed: {final_path} ({duration_of(final_path):.2f}s)")
        else:
            print(f"\nNOTE: out/{SLUG}.mp4 is {cur_video_dur:.2f}s but this voice take needs {total_s:.2f}s --")
            print("apply the durations above to the .tsx/Root.tsx and re-render before muxing.")


if __name__ == "__main__":
    main()
