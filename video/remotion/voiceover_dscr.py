"""
Add voiceover to the Remotion-rendered DSCR video -- same timestamp-driven
approach landed on for the JPMorgan video: generate ONE continuous take at
natural pace via ElevenLabs' with-timestamps endpoint, find each line's
real start time in that audio, then print the Remotion scene durations
that make the VIDEO match the VOICE (video timed to voice, not guessed).

Run from newsletter_video_pipeline/remotion/:  python voiceover_dscr.py
Then apply the printed durationInFrames values to DSCRVideo.tsx and the
printed TOTAL_S to Root.tsx, re-render, and this script will mux the exact
same audio it measured onto the fresh render.
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
SWIPE = 0.35  # matches SWIPE in DSCRVideo.tsx
FPS = 30
TAIL_PAD = 2.0

# One continuous script, in on-screen order. "DSCR" -> "D. S. C. R." so it's
# spelled out letter by letter instead of mangled as one word; "--" avoided
# since long dashes produced odd silences in a single long take before.
LINES = [
    "Most investors hit a wall at exactly ten properties.",
    "It's not the market. Not your credit. It's a rule banks don't explain.",
    "Fannie Mae caps conventional loans at ten financed properties, including your own home.",
    "Hit that number, and your bank legally can't write an eleventh loan.",
    "That's why serious investors move to D. S. C. R. loans.",
    "A D. S. C. R. loan skips your income and asks one thing: does the rent cover the mortgage?",
    "Most lenders want that ratio around one to one and a quarter.",
    "Each property qualifies on its own, so there's no ten property ceiling.",
    "Self-employed investors who write off income don't get penalized qualifying.",
    "D. S. C. R. loans just cost more in rate and down payment.",
    "Ten properties is the legal stop. D. S. C. R. is how you keep scaling.",
    "If you're near that number, have this conversation before your tenth loan gets denied.",
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
    voice_dir = base / "_voiceover_dscr"
    voice_dir.mkdir(exist_ok=True)

    audio_path = voice_dir / "narration.mp3"

    if audio_path.exists():
        print(f"Reusing existing narration at {audio_path} (delete it to regenerate a new take).")
        total_dur = duration_of(audio_path)
        align_path = voice_dir / "alignment.json"
        align = json.loads(align_path.read_text())
    else:
        script_text = " ".join(LINES)
        print("Generating one continuous narration with timestamps (ElevenLabs, cloned client voice)...")
        result = tts_with_timestamps(script_text)
        audio_path.write_bytes(base64.b64decode(result["audio_base64"]))
        align = result["alignment"]
        (voice_dir / "alignment.json").write_text(json.dumps(align))
        (voice_dir / "script.txt").write_text(script_text)
        total_dur = duration_of(audio_path)

    print(f"  {total_dur:.2f}s of natural-pace audio\n")

    script_text = (voice_dir / "script.txt").read_text() if (voice_dir / "script.txt").exists() else " ".join(LINES)
    chars = align["characters"]
    starts = align["character_start_times_seconds"]

    search_from = 0
    line_starts = []
    for line in LINES:
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

    print("\nScene durationInFrames to use in DSCRVideo.tsx (video timed to this voice take):")
    for i, d in enumerate(durations):
        print(f"  scene {i:02d}: s({d})  -> {round(d * FPS)} frames")

    total_s = sum(durations) - (len(durations) - 1) * SWIPE
    print(f"\nTOTAL_S for Root.tsx: {' + '.join(str(d) for d in durations)} - {len(durations)-1} * {SWIPE} = {total_s:.2f}")

    video_path = base / "out" / "dscr.mp4"
    final_path = base / "out" / "dscr_voice.mp4"
    if video_path.exists():
        cur_video_dur = duration_of(video_path)
        if abs(cur_video_dur - total_s) < 0.5:
            run(
                f'ffmpeg -y -i "{video_path}" -i "{audio_path}" '
                f'-c:v copy -map 0:v:0 -map 1:a:0 -c:a aac -shortest "{final_path}"'
            )
            print(f"\nVideo duration matches the voice take -- muxed: {final_path} ({duration_of(final_path):.2f}s)")
        else:
            print(f"\nNOTE: out/dscr.mp4 is {cur_video_dur:.2f}s but this voice take needs {total_s:.2f}s --")
            print("apply the durations above to DSCRVideo.tsx/Root.tsx and re-render before muxing.")


if __name__ == "__main__":
    main()
