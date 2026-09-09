import React from "react";
import { AbsoluteFill, staticFile, OffthreadVideo, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { Card } from "./components/Card";
import { GiantStat } from "./components/GiantStat";
import { BuildList } from "./components/BuildList";
import { DocumentCard } from "./components/DocumentCard";
import { BounceText } from "./components/BounceText";
import { ensureFontsLoaded } from "./fonts";
import * as t from "./tokens";

const FPS = 30;
const SWIPE = Math.round(0.35 * FPS);
const s = (seconds: number) => Math.round(seconds * FPS);

const ZoomPanImage: React.FC<{ src: string; durationInFrames: number; pan?: "center" | "top-to-bottom" | "left-to-right" }> = ({
  src,
  durationInFrames,
  pan = "center",
}) => {
  const frame = useCurrentFrame();
  const p = Math.min(1, frame / durationInFrames);
  const scale = 1 + 0.14 * p;
  let translate = "0,0";
  if (pan === "top-to-bottom") translate = `0,${-4 * p}%`;
  if (pan === "left-to-right") translate = `${-4 * p}%,0`;
  const [tx, ty] = translate.split(",");
  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale}) translate(${tx}, ${ty})` }} />
    </div>
  );
};

export const JPMorganVideo: React.FC = () => {
  ensureFontsLoaded();
  const assets = (name: string) => staticFile(`jpmorgan/${name}`);

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={s(3.26)}>
        <OpeningFullBleed
          videoSrc={assets("skyline_video.mp4")}
          logoSrc={assets("jpmorgan_logo.svg")}
          subtitle="CASE STUDY: A $750B HOUSING BET"
          headline="Big banks don't gamble. This is your cue."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-right" })} />

      <TransitionSeries.Sequence durationInFrames={s(7.04)}>
        <BoldStatementFullBleed
          eyebrow="THE POINT"
          text="This isn't a JPMorgan story — it's a signal every investor should be watching."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(4.77)}>
        <Card header="The Move" caption="Rates near 6.5%. Affordability at its worst. And JPMorgan is doubling down." insetW={700} insetH={460} headerAlign="left">
          <MiniStatStack
            rows={[
              { value: "6.5%", label: "average mortgage rate" },
              { value: "Worst in years", label: "housing affordability" },
            ]}
          />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-bottom" })} />

      <TransitionSeries.Sequence durationInFrames={s(3.79)}>
        <GiantStat text="$750" label="billion committed through 2035" targetValue={750} prefix="$" countDurationFrames={s(1.1)} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={fade()} />

      <TransitionSeries.Sequence durationInFrames={s(7.25)}>
        <TwinStatSplit
          header="The Commitment"
          caption="Both funded within the $750 billion bet."
          left={{ value: "1,000,000", label: "affordable units financed" }}
          right={{ value: "500,000", label: "new homeowners" }}
          rightStartFrame={s(3.6)}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={clockWipe({ width: 1080, height: 1920 })} />

      <TransitionSeries.Sequence durationInFrames={s(4.25)}>
        <BoldStatementFullBleed
          eyebrow="THE SIGNAL"
          text="Banks don't deploy three-quarters of a trillion dollars on a hunch. When they move this early, that's the signal to pay attention."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-top" })} />

      <TransitionSeries.Sequence durationInFrames={s(4.05)}>
        <Card header="The Buildout" caption="More lenders. More capacity. Faster approvals." insetW={780} insetH={560} headerAlign="left">
          <DocumentCard
            source="RISMedia"
            headline="JPMorganChase Ramps Up Mortgage Lending"
            body="The bank is increasing mortgage lending over 40% and hiring 850 new home lending advisers to handle it."
            highlightPhrase="increasing mortgage lending over 40%"
            width={780}
            height={560}
          />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={flip({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(7.07)}>
        <Card header="Reading the Signal" caption="This is when institutional capital moves — pricing the next decade, not this news cycle." insetW={640} insetH={860} headerAlign="left">
          <ZoomPanImage src={assets("nyse_photo.jpg")} durationInFrames={s(7.07)} pan="top-to-bottom" />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(3.4)}>
        <Card header="Setting Policy" caption="Shaping the rules, not just writing checks." insetW={780} insetH={560} headerAlign="left" bg="#faf9f5">
          <DocumentCard
            source="RISMedia"
            headline="JPMorganChase to Chair Housing Advisory Council"
            body="The bank is now chairing the U.S. Chamber of Commerce's new Housing Advisory Council — shaping policy, not just writing checks."
            highlightPhrase="chairing the U.S. Chamber of Commerce's new Housing Advisory Council"
            width={780}
            height={560}
            logoSrc={assets("jpmorgan_logo.svg")}
          />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={flip({ direction: "from-right" })} />

      <TransitionSeries.Sequence durationInFrames={s(4.51)}>
        <BuildList header="The Recap" items={["$750 billion", "1 million units financed", "500,000 buyers helped"]} itemStaggerFrames={s(1.1)} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-bottom" })} />

      <TransitionSeries.Sequence durationInFrames={s(5.89)}>
        <TakeawayClose caption="If the biggest bank in the country is this confident in real estate, that's not noise. That's your cue too." />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

/** Opener -- full-bleed drone skyline video, dark gradient for legibility,
 * the JPMorgan logo fading in up top, bold stroke-outline headline anchored
 * to the bottom (mirrors the frame-05 video-overlay treatment from the
 * Mayweather video, but as the cold open instead of a mid-video beat). */
const OpeningFullBleed: React.FC<{ videoSrc: string; logoSrc: string; subtitle: string; headline: string }> = ({ videoSrc, logoSrc, subtitle, headline }) => {
  const frame = useCurrentFrame();
  const logoOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame - 10, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.05) 55%, rgba(0,0,0,0.75) 100%)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <img src={logoSrc} style={{ height: 130, opacity: logoOpacity, filter: "brightness(0) invert(1)" }} />
        <div style={{ marginTop: 18, fontFamily: "AgencyFB-Bold", fontSize: 26, color: "#ffffff", letterSpacing: 3, opacity: subtitleOpacity }}>{subtitle}</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 260, paddingLeft: 70, paddingRight: 70 }}>
        <div style={{ WebkitTextStroke: "8px #000", paintOrder: "stroke fill" }}>
          <BounceText text={headline} fontSize={72} color="#ffffff" maxWidth={940} stagger={2.5} align="center" />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Small stat-stack used as a Card inset -- two rows of value+label,
 * bouncing in one after another, for beats that need numbers but not a
 * full-bleed treatment. */
const MiniStatStack: React.FC<{ rows: { value: string; label: string }[] }> = ({ rows }) => (
  <AbsoluteFill style={{ backgroundColor: t.INSET_BG, justifyContent: "center", alignItems: "center" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ textAlign: "center" }}>
          <BounceText text={row.value} fontSize={64} color={t.INK} startFrame={4 + i * 14} stagger={2.5} />
          <div style={{ marginTop: 6 }}>
            <BounceText text={row.label} fontSize={30} color="#5a5a5a" startFrame={10 + i * 14} stagger={2} />
          </div>
        </div>
      ))}
    </div>
  </AbsoluteFill>
);

/** Full-bleed twin-stat reveal -- generalized version of the split-screen
 * comparison pattern (two color-free columns here, since neither figure is
 * a "these vs. those" opposition, just two facts from one commitment). */
const TwinStatSplit: React.FC<{
  header: string;
  caption: string;
  left: { value: string; label: string };
  right: { value: string; label: string };
  rightStartFrame: number;
}> = ({ header, caption, left, right, rightStartFrame }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center" }}>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 60 }}>
          <BounceText text={header} fontSize={72} color={t.INK} startFrame={2} stagger={2.5} />
        </div>
        <div style={{ display: "flex" }}>
          <StatHalf value={left.value} label={left.label} startFrame={4} />
          <div style={{ width: 2, backgroundColor: "#d8d8d3", margin: "10px 0" }} />
          <StatHalf value={right.value} label={right.label} startFrame={rightStartFrame} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 60 }}>
          <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "20px 28px", maxWidth: 900 }}>
            <BounceText text={caption} fontSize={38} color={t.CAPTION_FG} startFrame={rightStartFrame + 14} stagger={2.2} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const StatHalf: React.FC<{ value: string; label: string; startFrame: number }> = ({ value, label, startFrame }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 24px" }}>
    <BounceText text={value} fontSize={72} color={t.INK} startFrame={startFrame} stagger={2} align="center" />
    <BounceText text={label} fontSize={30} color="#5a5a5a" startFrame={startFrame + 8} stagger={2} align="center" maxWidth={330} />
  </div>
);

/** Full-bleed bold-statement beat -- a small uppercase eyebrow label above
 * one giant bounced statement, no card box, used for the two "here's the
 * lesson" beats so they read as authorial commentary rather than a fact
 * card. */
const BoldStatementFullBleed: React.FC<{ eyebrow: string; text: string }> = ({ eyebrow, text }) => (
  <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center", alignItems: "center" }}>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 920 }}>
      <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 30, color: t.BAR_ACCENT, letterSpacing: 4, marginBottom: 30 }}>{eyebrow}</div>
      <BounceText text={text} fontSize={68} color={t.INK} startFrame={6} stagger={2.5} align="center" maxWidth={920} />
    </div>
  </AbsoluteFill>
);

/** Closer -- a single accent bar growing upward (capital flowing into real
 * estate) instead of Mayweather's stacked equity/debt bar, so the closing
 * beat reads as distinct rather than a reused chart. */
/** Closer -- a radar-style signal pulse (expanding, fading rings around a
 * solid dot) instead of a growth bar chart, since the closing line is about
 * recognizing a signal/cue, not a stat -- a bar chart read as an unrelated
 * "line goes up" graphic against words that aren't making a numeric claim. */
const TakeawayClose: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const RING_COUNT = 3;
  const RING_STAGGER = 16;
  const RING_LIFE = 40;
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center" }}>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 50 }}>
          <BounceText text="The Takeaway" fontSize={96} color={t.INK} startFrame={2} stagger={2.5} />
        </div>
        <div style={{ position: "relative", width: "100%", height: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {Array.from({ length: RING_COUNT }).map((_, i) => {
            const local = Math.max(0, frame - i * RING_STAGGER);
            const p = Math.min(1, local / RING_LIFE);
            const size = 60 + p * 340;
            const opacity = local <= 0 ? 0 : 1 - p;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  border: `6px solid ${t.BAR_ACCENT}`,
                  opacity,
                }}
              />
            );
          })}
          <div style={{ width: 90, height: 90, borderRadius: "50%", backgroundColor: t.BAR_ACCENT }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
          <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "22px 30px", maxWidth: 950 }}>
            <BounceText text={caption} fontSize={44} color={t.CAPTION_FG} startFrame={30} stagger={2} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
