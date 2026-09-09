"""
Add voiceover to the Remotion-rendered Mayweather video.

Unlike the old Python-pipeline ticket7 (which reflowed frame durations to
match the voice), the Remotion scene durations are already fixed and the
video is already rendered -- so here the voice is fit INTO the existing
timeline: each scene's line is generated, mildly time-stretched if it runs
long for its slot, then placed at that scene's actual on-screen start time
(computed the same way Remotion's TransitionSeries overlaps swipes) and
mixed into one continuous track that's muxed under the picture.

Run from newsletter_video_pipeline/remotion/:  python ../voiceover_mayweather.py
"""
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
SWIPE = 0.35
MAX_ATEMPO = 1.1  # cap on how much we'll speed up a line before it slurs -- scenes
# were lengthened specifically so lines can be spoken at a natural pace

# (durationSeconds, line) for each of the 12 scenes, in on-screen order --
# durations must match the durationInFrames values in MayweatherVideo.tsx.
# Each line is a connected beat in one continuous, enthusiastic story --
# not an isolated fact -- while still fitting its scene's fast cut.
SCENES = [
    (2.5, "Floyd Mayweather just made a massive move."),
    (4.5, "He put a hundred million into a three billion dollar portfolio."),
    (5.0, "Here's the twist -- it's a joint venture with Go Partners and Vada Properties."),
    (4.5, "The anchor asset? Twin towers in Murray Hill, snapped up for eight fifty million."),
    (4.0, "And that's just the start -- four more buildings worth one point seven billion."),
    (3.0, "Three billion dollars. That's the size of this portfolio."),
    (4.5, "But get this -- his hundred million is only three percent of that total."),
    (5.0, "It's the same math as a twenty K down payment on a house, just bigger."),
    (4.5, "And get this -- five sixty million is his entire boxing career earnings."),
    (4.5, "His exact ownership stake was never made public -- only these numbers were."),
    (4.5, "So to recap -- a hundred million in, three billion total, three percent stake."),
    (5.5, "Here's the takeaway -- you don't need a hundred million to use this leverage yourself."),
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


def tts(text: str, out_path: Path):
    key = os.environ["ELEVENLABS_API_KEY"]
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    body = json.dumps({
        "text": text,
        "model_id": MODEL_ID,
        "voice_settings": {"stability": 0.35, "similarity_boost": 0.8, "style": 0.65, "use_speaker_boost": True},
    }).encode("utf-8")
    req = urllib.request.Request(
        url, data=body,
        headers={"xi-api-key": key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"ElevenLabs TTS failed: {e.code} {e.read().decode()}")
    out_path.write_bytes(data)


def main():
    base = Path(__file__).parent  # remotion/
    voice_dir = base / "_voiceover"
    voice_dir.mkdir(exist_ok=True)

    print("Generating narration with ElevenLabs (cloned client voice)...")
    starts = []
    t = 0.0
    clips = []
    for i, (dur, line) in enumerate(SCENES):
        starts.append(t)
        t += dur - SWIPE

        raw_path = voice_dir / f"scene_{i:02d}_raw.mp3"
        mp3_path = voice_dir / f"scene_{i:02d}.mp3"
        tts(line, raw_path)
        spoken = duration_of(raw_path)

        # only speed up if the line runs long for its slot -- never slow down
        tempo = min(MAX_ATEMPO, max(1.0, spoken / dur))
        run(f'ffmpeg -y -i "{raw_path}" -filter:a "atempo={tempo}" "{mp3_path}"')
        raw_path.unlink()
        final_dur = duration_of(mp3_path)
        clips.append(mp3_path)
        print(f"  scene {i:02d}: {spoken:.2f}s spoken -> {final_dur:.2f}s (tempo {tempo:.2f}x), slot {dur}s, starts at {starts[i]:.2f}s  \"{line[:55]}\"")

    print("\nBuilding narration track...")
    inputs = []
    filter_parts = []
    for i, mp3_path in enumerate(clips):
        inputs.append(f'-i "{mp3_path}"')
        delay_ms = int(max(0.0, starts[i]) * 1000)
        filter_parts.append(f"[{i}:a]adelay={delay_ms}|{delay_ms}[a{i}]")
    mix_inputs = "".join(f"[a{i}]" for i in range(len(clips)))
    filter_complex = ";".join(filter_parts) + f";{mix_inputs}amix=inputs={len(clips)}:normalize=0[aout]"

    narration_path = base / "_voiceover" / "narration.wav"
    run(
        f'ffmpeg -y {" ".join(inputs)} -filter_complex "{filter_complex}" '
        f'-map "[aout]" -ar 44100 "{narration_path}"'
    )

    video_path = base / "out" / "mayweather.mp4"
    final_path = base / "out" / "mayweather_voice.mp4"
    run(
        f'ffmpeg -y -i "{video_path}" -i "{narration_path}" '
        f'-c:v copy -map 0:v:0 -map 1:a:0 -c:a aac -shortest "{final_path}"'
    )

    print(f"\nFinal video with voiceover: {final_path} ({duration_of(final_path):.2f}s)")


if __name__ == "__main__":
    main()
