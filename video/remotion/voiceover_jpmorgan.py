"""
Add voiceover to the Remotion-rendered JPMorgan video -- timestamp-driven
version.

Problems with the previous approaches:
  1. Per-scene clips stitched with adelay/amix sounded choppy (each clip is
     an independent synthesis with its own breath/pitch reset).
  2. A single continuous take fixed the choppiness but drifted out of sync
     with the video, since the video's scene durations were hand-guessed
     and didn't match this take's actual pacing.
  3. Time-stretching the single take with atempo to force it into a
     pre-fixed video length introduced word-level artifacts (audible
     silence gaps, mispronunciations).
  4. "JPMorgan" (no space) was being read as "J Morgan" -- ElevenLabs needs
     it spelled with periods to say the initials correctly.

Fix: generate ONE continuous take at natural pace (no stretching) using
ElevenLabs' with-timestamps endpoint, which returns character-level
alignment. Find each line's start time in that real audio, then print the
Remotion scene durations that would make the VIDEO match the VOICE (the
video is timed to the voice, not the other way around -- same principle
as the old Python-pipeline ticket7).

Run from newsletter_video_pipeline/remotion/:  python voiceover_jpmorgan.py
Then apply the printed durationInFrames values to JPMorganVideo.tsx and
the printed TOTAL_S to Root.tsx, and re-render.
"""
import base64
import json
import os
import subprocess
import urllib.request
import urllib.error
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

VOICE_ID = "oWdwRrGpAwNn1T1p5ZQK"  # cloned client narrator voice
MODEL_ID = "eleven_multilingual_v2"
SWIPE = 0.35  # matches SWIPE in JPMorganVideo.tsx -- each transition eats this much via overlap
FPS = 30
TAIL_PAD = 2.0  # breathing room after the last line before the video ends

# One continuous script, in on-screen order. "JPMorgan" -> "J.P. Morgan" so
# it's pronounced correctly; "--" replaced with commas since long dashes in
# a single long take were producing odd silences.
LINES = [
    "Big banks don't gamble. This is your cue.",
    "This isn't a J.P. Morgan story, it's a signal every investor should watch.",
    "Rates are near six and a half percent, and J.P. Morgan just doubled down.",
    "Seven hundred fifty billion dollars, that's the size of this bet.",
    "A million affordable units financed, and half a million new homeowners, all from one commitment.",
    "Banks don't deploy three quarters of a trillion dollars on a hunch.",
    "They're hiring eight fifty new advisers to keep up.",
    "This is exactly when institutional money moves, while everyone else is scared.",
    "They're even chairing the new Housing Advisory Council now.",
    "Seven fifty billion. A million units. Half a million buyers.",
    "If the biggest bank in the country is this confident, that's your cue too.",
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
        "voice_settings": {"stability": 0.3, "similarity_boost": 0.8, "style": 0.75, "use_speaker_boost": True},
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
    voice_dir = base / "_voiceover_jpmorgan"
    voice_dir.mkdir(exist_ok=True)

    script_text = " ".join(LINES)
    print("Generating one continuous narration with timestamps (ElevenLabs, cloned client voice)...")
    result = tts_with_timestamps(script_text)

    audio_path = voice_dir / "narration.mp3"
    audio_path.write_bytes(base64.b64decode(result["audio_base64"]))
    total_dur = duration_of(audio_path)
    print(f"  {total_dur:.2f}s of natural-pace audio generated\n")

    align = result["alignment"]
    chars = align["characters"]
    starts = align["character_start_times_seconds"]

    # locate each line's start time by finding where it begins in the exact
    # text we sent (searching forward so repeated words don't confuse it)
    search_from = 0
    line_starts = []
    for line in LINES:
        idx = script_text.index(line, search_from)
        line_starts.append(starts[idx])
        search_from = idx + len(line)

    print("Per-line actual start times in the generated audio:")
    for line, st in zip(LINES, line_starts):
        print(f"  {st:6.2f}s  \"{line[:60]}\"")

    # video is timed to the voice: duration[i] = (nextStart - thisStart) + SWIPE,
    # so that after each transition's overlap eats SWIPE seconds, the next
    # scene's content still lands exactly on that line's real start time.
    durations = []
    for i in range(len(line_starts) - 1):
        durations.append(round(line_starts[i + 1] - line_starts[i] + SWIPE, 2))
    durations.append(round(total_dur - line_starts[-1] + TAIL_PAD, 2))

    print("\nScene durationInFrames to use in JPMorganVideo.tsx (video timed to this voice take):")
    for i, d in enumerate(durations):
        print(f"  scene {i:02d}: s({d})  -> {round(d * FPS)} frames")

    total_s = sum(durations) - (len(durations) - 1) * SWIPE
    print(f"\nTOTAL_S for Root.tsx: {' + '.join(str(d) for d in durations)} - {len(durations)-1} * {SWIPE} = {total_s:.2f}")

    video_path = base / "out" / "jpmorgan.mp4"
    final_path = base / "out" / "jpmorgan_voice.mp4"
    run(
        f'ffmpeg -y -i "{video_path}" -i "{audio_path}" '
        f'-c:v copy -map 0:v:0 -map 1:a:0 -c:a aac -shortest "{final_path}"'
    )
    print(f"\nFinal video with voiceover: {final_path} ({duration_of(final_path):.2f}s)")


if __name__ == "__main__":
    main()
