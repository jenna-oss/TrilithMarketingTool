import { Composition } from "remotion";
import { MayweatherVideo } from "./MayweatherVideo";
import { JPMorganVideo } from "./JPMorganVideo";
import { DSCRVideo } from "./DSCRVideo";
import { ConstructionVideo } from "./ConstructionVideo";
import { ArnoldSchwarzeneggerRealEstateVideo } from "./ArnoldSchwarzeneggerRealEstateVideo";
import { LendersCountRealEstateExperienceVideo } from "./LendersCountRealEstateExperienceVideo";
import { FrameExample } from "./FrameExample";

const FPS = 30;
// Sum of all sequence durations minus the overlap eaten by each of the
// 11 swipe transitions (0.35s each) between the 12 scenes.
const MAYWEATHER_TOTAL_S = 2.5 + 4.5 + 5 + 4.5 + 4 + 3 + 4.5 + 5 + 4.5 + 4.5 + 4.5 + 5.5 - 11 * 0.35;

// Sum of all sequence durations minus the overlap eaten by each of the
// 10 swipe transitions (0.35s each) between the 11 scenes. These durations
// come directly from the actual ElevenLabs narration timestamps (see
// voiceover_jpmorgan.py) so the video is timed to the voice, not guessed.
const JPMORGAN_TOTAL_S = 3.26 + 7.04 + 4.77 + 3.79 + 7.25 + 4.25 + 4.05 + 7.07 + 3.4 + 4.51 + 5.89 - 10 * 0.35;

// Sum of all sequence durations minus the overlap eaten by each of the
// 11 swipe transitions (0.35s each) between the 12 scenes. These durations
// come directly from the actual ElevenLabs narration timestamps (see
// voiceover_dscr.py) so the video is timed to the voice, not guessed.
const DSCR_TOTAL_S = 5.27 + 5.54 + 6.15 + 5.3 + 5.21 + 7.08 + 3.82 + 5.37 + 5.25 + 5.63 + 5.59 + 6.8 - 11 * 0.35;

// Sum of all sequence durations minus the overlap eaten by each of the
// 11 swipe transitions (0.35s each) between the 12 scenes. These durations
// come directly from the actual ElevenLabs narration timestamps (see
// voiceover_construction.py) so the video is timed to the voice, not guessed.
const CONSTRUCTION_TOTAL_S = 3.68 + 5.24 + 4.73 + 3.11 + 5.4 + 6.32 + 4.31 + 5.63 + 5.19 + 5.11 + 4.05 + 6.72 - 11 * 0.35;

// Sum of all sequence durations minus the overlap eaten by each of the
// 12 swipe transitions (0.35s each) between the 13 scenes. These durations
// come directly from the actual ElevenLabs narration timestamps (see
// voiceover_arnold-schwarzenegger-real-estate.py) so the video is timed to
// the voice, not guessed.
const ARNOLD_SCHWARZENEGGER_REAL_ESTATE_TOTAL_S =
  7.49 + 10.55 + 8.8 + 7.91 + 5.22 + 6.33 + 9.69 + 10.44 + 8.2 + 6.89 + 10.84 + 8.98 + 10.73 - 12 * 0.35;

// Sum of all sequence durations minus the overlap eaten by each of the
// 12 swipe transitions (0.35s each) between the 13 scenes. These are the
// initial estSeconds guesses from the script -- the Voiceover stage will
// correct them against the actual ElevenLabs narration timestamps.
const LENDERS_COUNT_REAL_ESTATE_EXPERIENCE_TOTAL_S =
  8.84 + 6.78 + 4.11 + 7.49 + 5.98 + 6.76 + 7.41 + 5.91 + 7.12 + 5.49 + 6.36 + 5.02 + 7.51 - 12 * 0.35;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Mayweather"
        component={MayweatherVideo}
        durationInFrames={Math.round(MAYWEATHER_TOTAL_S * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="JPMorgan"
        component={JPMorganVideo}
        durationInFrames={Math.round(JPMORGAN_TOTAL_S * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="DSCR"
        component={DSCRVideo}
        durationInFrames={Math.round(DSCR_TOTAL_S * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="Construction"
        component={ConstructionVideo}
        durationInFrames={Math.round(CONSTRUCTION_TOTAL_S * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="ArnoldSchwarzeneggerRealEstate"
        component={ArnoldSchwarzeneggerRealEstateVideo}
        durationInFrames={Math.round(ARNOLD_SCHWARZENEGGER_REAL_ESTATE_TOTAL_S * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="LendersCountRealEstateExperience"
        component={LendersCountRealEstateExperienceVideo}
        durationInFrames={Math.round(LENDERS_COUNT_REAL_ESTATE_EXPERIENCE_TOTAL_S * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="FrameExample"
        component={FrameExample}
        durationInFrames={30}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
