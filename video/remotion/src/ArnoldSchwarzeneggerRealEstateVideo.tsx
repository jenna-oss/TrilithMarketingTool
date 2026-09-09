import React from "react";
import { AbsoluteFill, staticFile, OffthreadVideo, useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { Card } from "./components/Card";
import { BuildList } from "./components/BuildList";
import { DocumentCard } from "./components/DocumentCard";
import { BounceText } from "./components/BounceText";
import { FONT_BOLD } from "./fonts";
import { ensureFontsLoaded } from "./fonts";
import * as t from "./tokens";

const FPS = 30;
const SWIPE = Math.round(0.35 * FPS);
const s = (seconds: number) => Math.round(seconds * FPS);

export const ArnoldSchwarzeneggerRealEstateVideo: React.FC = () => {
  ensureFontsLoaded();
  const assets = (name: string) => staticFile(`arnold-schwarzenegger-real-estate/${name}`);

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={s(7.49)}>
        <OpeningFullBleed
          videoSrc={assets("beat_1.mp4")}
          headline="Arnold Schwarzenegger's first real estate deal wasn't a mansion. It was a six-unit apartment building."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-right" })} />

      <TransitionSeries.Sequence durationInFrames={s(10.55)}>
        <Card
          header="The Buy"
          caption="In the early 1970s, Schwarzenegger bought that six-plex as a 20-something bodybuilder with no full-time job."
          insetW={720}
          insetH={520}
          headerAlign="left"
          headerSize={130}
          captionFontSize={56}
        >
          <ChecklistInset items={["Early 1970s purchase", "20-something bodybuilder", "No full-time job", "Contest winnings + mail-order income"]} />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(8.8)}>
        <TwinTextVideoSplit
          videoSrc={assets("beat_3.mp4")}
          topText="Arrived in the US in 1968 — broke."
          bottomText="Funded the down payment through bodybuilding purses and side seminars."
          topFontSize={84}
          bottomFontSize={78}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={fade()} />

      <TransitionSeries.Sequence durationInFrames={s(7.91)}>
        <GiantStatDual
          topValue={240000}
          topLabel="listing price"
          topFontSize={168}
          bottomValue={27500}
          bottomLabel="down payment"
          bottomFontSize={140}
          bottomStartFrame={s(1.5)}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={flip({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(5.22)}>
        <BuildList
          header="Six Units"
          items={["Unit 1 — Arnold moved in himself", "Unit 2 — rented out", "Unit 3 — rented out", "Unit 4 — rented out", "Unit 5 — rented out", "Unit 6 — rented out"]}
          itemStaggerFrames={s(0.32)}
          headerFontSize={110}
          itemFontSize={80}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={clockWipe({ width: 1080, height: 1920 })} />

      <TransitionSeries.Sequence durationInFrames={s(6.33)}>
        <Card
          header="The Math"
          caption="Those five tenants' rent covered the mortgage — Arnold lived there for free while the building built equity underneath him."
          insetW={780}
          insetH={560}
          headerAlign="left"
          headerSize={140}
          captionFontSize={50}
        >
          <DocumentCard
            source="Historical Account"
            headline="Rent Covers the Mortgage"
            body="Five tenants' monthly rent fully covered the mortgage payments, letting Schwarzenegger live in his own unit for free."
            highlightPhrase="fully covered the mortgage payments"
            width={780}
            height={560}
          />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-top" })} />

      <TransitionSeries.Sequence durationInFrames={s(9.69)}>
        <StepProcess
          steps={["Six-Plex", "12-Unit Building", "36-Unit Building"]}
          caption="About three years later, he reportedly sold the six-plex and traded up — twice."
          headerFontSize={104}
          stepFontSize={78}
          captionFontSize={50}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-bottom" })} />

      <TransitionSeries.Sequence durationInFrames={s(10.44)}>
        <Card
          header="The Caveat"
          caption="That six-to-twelve-to-thirty-six progression gets repeated everywhere online, but it's not independently verified beyond celebrity net worth sites."
          insetW={700}
          insetH={460}
          headerAlign="left"
          headerSize={125}
          captionFontSize={48}
        >
          <CaveatInset lines={["Widely repeated online", "Not independently verified", "Sourced from net-worth sites"]} />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={flip({ direction: "from-right" })} />

      <TransitionSeries.Sequence durationInFrames={s(8.2)}>
        <GiantStatFullBleedVideo
          videoSrc={assets("beat_9.mp4")}
          topValue="$450K"
          arrow="→"
          bottomValue="$2.3M"
          label="one often-cited Santa Monica deal"
          fontSize={160}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-bottom" })} />

      <TransitionSeries.Sequence durationInFrames={s(6.89)}>
        <Card
          header="The Nevada Deal"
          caption="Another: a Nevada office building that reportedly netted him $7 million in profit."
          insetW={700}
          insetH={460}
          headerAlign="left"
          headerSize={90}
          captionFontSize={46}
        >
          <DocumentCard
            source="Reported Deal"
            headline="Nevada Office Building"
            body="The building reportedly netted him $7 million in profit on resale."
            highlightPhrase="$7 million in profit"
            width={700}
            height={460}
          />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(10.84)}>
        <BoldStatementFullBleedVideo
          videoSrc={assets("beat_11.mp4")}
          eyebrow="THE VERIFIED CORE"
          text="House-hack a small multifamily. Let the tenants cover the mortgage. Reinvest the equity into something bigger."
          fontSize={128}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={fade()} />

      <TransitionSeries.Sequence durationInFrames={s(8.98)}>
        <Card
          header="How It Actually Started"
          caption="That's how it actually started."
          insetW={760}
          insetH={620}
          headerAlign="center"
          captionFontSize={50}
        >
          <MiniStatStack
            rows={[
              { value: "$240,000", label: "building" },
              { value: "$27,500", label: "down" },
              { value: "5 tenants", label: "paying his mortgage" },
            ]}
          />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={clockWipe({ width: 1080, height: 1920 })} />

      <TransitionSeries.Sequence durationInFrames={s(10.73)}>
        <SignalPulseClose
          header="Before the Movies"
          caption="Long before the movies and the politics, that was Schwarzenegger's first real move — buy the place you can live in for free."
        />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

/** Opener -- full-bleed real apartment-building footage, dark gradient for
 * legibility, bold stroke-outline headline anchored to the bottom (same
 * cold-open treatment used across the other videos in the series). */
const OpeningFullBleed: React.FC<{ videoSrc: string; headline: string }> = ({ videoSrc, headline }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <OffthreadVideo src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.75) 100%)" }} />
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 260, paddingLeft: 70, paddingRight: 70 }}>
      <div style={{ WebkitTextStroke: "12px #000", paintOrder: "stroke fill" }}>
        <BounceText text={headline} fontSize={175} color="#F7E7CE" maxWidth={1000} stagger={2.5} align="center" />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

/** Card inset -- plain bulleted checklist, reused pattern from the
 * ConstructionVideo's ChecklistInset, for beats listing several short
 * facts without needing a chart or document. */
const ChecklistInset: React.FC<{ items: string[] }> = ({ items }) => (
  <AbsoluteFill style={{ backgroundColor: t.INSET_BG, justifyContent: "center", alignItems: "flex-start", padding: "0 44px" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 18, height: 18, backgroundColor: t.BAR_ACCENT }} />
          <BounceText text={item} fontSize={48} color={t.INK} align="left" startFrame={4 + i * 10} stagger={1.8} maxWidth={600} />
        </div>
      ))}
    </div>
  </AbsoluteFill>
);

/** Full-bleed real-video split -- one clip in the background, a top-half
 * caption revealing first and a bottom-half caption landing after it, so a
 * single asset can still carry a "left fact vs. right fact" split without a
 * literal vertical divider. */
const TwinTextVideoSplit: React.FC<{
  videoSrc: string;
  topText: string;
  bottomText: string;
  topFontSize: number;
  bottomFontSize: number;
}> = ({ videoSrc, topText, bottomText, topFontSize, bottomFontSize }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <OffthreadVideo src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 35%, rgba(0,0,0,0.1) 65%, rgba(0,0,0,0.7) 100%)" }} />
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 200, paddingLeft: 70, paddingRight: 70 }}>
      <div style={{ WebkitTextStroke: "6px #000", paintOrder: "stroke fill" }}>
        <BounceText text={topText} fontSize={topFontSize} color="#F7E7CE" maxWidth={900} stagger={2.2} align="center" startFrame={2} />
      </div>
    </AbsoluteFill>
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 220, paddingLeft: 70, paddingRight: 70 }}>
      <div style={{ WebkitTextStroke: "6px #000", paintOrder: "stroke fill" }}>
        <BounceText text={bottomText} fontSize={bottomFontSize} color="#F7E7CE" maxWidth={900} stagger={2.2} align="center" startFrame={26} />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

/** Full-bleed dual giant stat -- the listing price counts up first, then
 * the down payment amount counts up beneath it once the top figure lands,
 * so both numbers land as their own beat instead of one flat stat card. */
const GiantStatDual: React.FC<{
  topValue: number;
  topLabel: string;
  topFontSize: number;
  bottomValue: number;
  bottomLabel: string;
  bottomFontSize: number;
  bottomStartFrame: number;
}> = ({ topValue, topLabel, topFontSize, bottomValue, bottomLabel, bottomFontSize, bottomStartFrame }) => {
  const frame = useCurrentFrame();
  const topP = interpolate(frame, [0, s(1.1)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const bottomP = interpolate(frame - bottomStartFrame, [0, s(0.9)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const bottomOpacity = interpolate(frame - bottomStartFrame, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: FONT_BOLD, fontSize: topFontSize, color: t.INK, lineHeight: 1 }}>
          ${Math.round(topValue * topP).toLocaleString()}
        </div>
        {topP >= 1 && (
          <div style={{ marginTop: 18 }}>
            <BounceText text={topLabel} fontSize={54} color="#3E5872" startFrame={s(1.1)} stagger={2.2} />
          </div>
        )}
        <div style={{ marginTop: 56, opacity: bottomOpacity }}>
          <div style={{ fontFamily: FONT_BOLD, fontSize: bottomFontSize, color: t.BAR_ACCENT, lineHeight: 1 }}>
            ${Math.round(bottomValue * bottomP).toLocaleString()}
          </div>
          {bottomP >= 1 && (
            <div style={{ marginTop: 14 }}>
              <BounceText text={bottomLabel} fontSize={44} color="#3E5872" startFrame={bottomStartFrame + s(0.9)} stagger={2} />
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Card inset -- a "flagged" caveat treatment: a dashed border and an
 * "UNVERIFIED" stamp-style tag above a short stack of qualifying lines, so
 * the fact-check beat visually reads as a caution rather than a normal
 * bulleted fact list. */
const CaveatInset: React.FC<{ lines: string[] }> = ({ lines }) => (
  <AbsoluteFill style={{ backgroundColor: t.INSET_BG, justifyContent: "center", alignItems: "center" }}>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, border: `3px dashed ${t.BAR_ACCENT}`, padding: "30px 40px" }}>
      <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 36, color: t.BAR_ACCENT, letterSpacing: 5 }}>UNVERIFIED</div>
      {lines.map((line, i) => (
        <BounceText key={i} text={line} fontSize={42} color={t.INK} align="center" startFrame={6 + i * 10} stagger={1.8} maxWidth={540} />
      ))}
    </div>
  </AbsoluteFill>
);

/** Full-bleed 3-step trade-up reveal -- each step pops in connected by a
 * vertical line, same treatment as the ConstructionVideo's draw-schedule
 * beat, repurposed here for the six-plex -> 12-unit -> 36-unit progression. */
const StepProcess: React.FC<{ steps: string[]; caption: string; headerFontSize: number; stepFontSize: number; captionFontSize: number }> = ({
  steps,
  caption,
  headerFontSize,
  stepFontSize,
  captionFontSize,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center" }}>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 44 }}>
          <BounceText text="The Trade-Up" fontSize={headerFontSize} color={t.INK} startFrame={2} stagger={2.5} maxWidth={950} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0, paddingLeft: 70 }}>
          {steps.map((step, i) => {
            const start = 10 + i * 16;
            const opacity = interpolate(frame - start, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const x = interpolate(frame - start, [0, 10], [-30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 26, height: 96, opacity, transform: `translateX(${x}px)` }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 66, height: 66, borderRadius: "50%", backgroundColor: t.BAR_ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "AgencyFB-Bold", fontSize: 38, color: t.BG }}>
                    {i + 1}
                  </div>
                  {i < steps.length - 1 && <div style={{ width: 4, height: 44, backgroundColor: t.BORDER }} />}
                </div>
                <div style={{ fontFamily: "AgencyFB-Bold", fontSize: stepFontSize, color: t.INK }}>{step}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 44 }}>
          <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "18px 26px", maxWidth: 900 }}>
            <BounceText text={caption} fontSize={captionFontSize} color={t.CAPTION_FG} startFrame={10 + steps.length * 16 + 6} stagger={2.2} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Full-bleed giant stat over real video -- a "before -> after" price arrow
 * (bought-for vs. sold-for) with a dark gradient for legibility, instead of
 * the flat-white GiantStat component, so the numbers read against the real
 * Santa Monica building footage they're describing. */
const GiantStatFullBleedVideo: React.FC<{ videoSrc: string; topValue: string; arrow: string; bottomValue: string; label: string; fontSize: number }> = ({
  videoSrc,
  topValue,
  arrow,
  bottomValue,
  label,
  fontSize,
}) => {
  const frame = useCurrentFrame();
  const arrowOpacity = interpolate(frame - 14, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bottomOpacity = interpolate(frame - 24, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.75) 100%)" }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: FONT_BOLD, fontSize, color: "#F7E7CE", lineHeight: 1, WebkitTextStroke: "3px #000", paintOrder: "stroke fill" }}>{topValue}</div>
          <div style={{ fontFamily: FONT_BOLD, fontSize: fontSize * 0.6, color: t.BAR_ACCENT, opacity: arrowOpacity, margin: "10px 0" }}>{arrow}</div>
          <div style={{ fontFamily: FONT_BOLD, fontSize, color: "#F7E7CE", lineHeight: 1, opacity: bottomOpacity, WebkitTextStroke: "3px #000", paintOrder: "stroke fill" }}>
            {bottomValue}
          </div>
          <div style={{ marginTop: 34, opacity: bottomOpacity }}>
            <BounceText text={label} fontSize={48} color="#F7E7CE" startFrame={30} stagger={2.2} maxWidth={860} align="center" />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Small stat-stack used as a Card inset -- reused pattern from the
 * JPMorgan/DSCR/Construction videos, extended here to three rows for the
 * three-figure recap beat. */
const MiniStatStack: React.FC<{ rows: { value: string; label: string }[] }> = ({ rows }) => (
  <AbsoluteFill style={{ backgroundColor: t.INSET_BG, justifyContent: "center", alignItems: "center" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ textAlign: "center" }}>
          <BounceText text={row.value} fontSize={76} color={t.INK} startFrame={4 + i * 12} stagger={2.2} />
          <div style={{ marginTop: 8 }}>
            <BounceText text={row.label} fontSize={36} color="#3E5872" startFrame={9 + i * 12} stagger={2} />
          </div>
        </div>
      ))}
    </div>
  </AbsoluteFill>
);

/** Full-bleed bold-statement beat over real video -- same eyebrow +
 * bounced-statement treatment as the other videos' BoldStatementFullBleed,
 * but with a real video background and dark gradient instead of a flat
 * white card, for the "here's the verified lesson" beat. */
const BoldStatementFullBleedVideo: React.FC<{ videoSrc: string; eyebrow: string; text: string; fontSize: number }> = ({ videoSrc, eyebrow, text, fontSize }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <OffthreadVideo src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.75) 100%)" }} />
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 900 }}>
        <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 40, color: t.BAR_ACCENT, letterSpacing: 5, marginBottom: 36 }}>{eyebrow}</div>
        <div style={{ WebkitTextStroke: "5px #000", paintOrder: "stroke fill" }}>
          <BounceText text={text} fontSize={fontSize} color="#F7E7CE" startFrame={6} stagger={2.5} align="center" maxWidth={920} />
        </div>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

/** Closer -- reuses the radar-style signal pulse from the JPMorgan/DSCR/
 * Construction closers, for visual consistency across the whole video
 * series. */
const SignalPulseClose: React.FC<{ header: string; caption: string }> = ({ header, caption }) => {
  const frame = useCurrentFrame();
  const RING_COUNT = 3;
  const RING_STAGGER = 16;
  const RING_LIFE = 40;
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center" }}>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 46 }}>
          <BounceText text={header} fontSize={100} color={t.INK} startFrame={2} stagger={2.5} maxWidth={960} />
        </div>
        <div style={{ position: "relative", width: "100%", height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {Array.from({ length: RING_COUNT }).map((_, i) => {
            const local = Math.max(0, frame - i * RING_STAGGER);
            const p = Math.min(1, local / RING_LIFE);
            const size = 50 + p * 300;
            const opacity = local <= 0 ? 0 : 1 - p;
            return (
              <div
                key={i}
                style={{ position: "absolute", width: size, height: size, borderRadius: "50%", border: `6px solid ${t.BAR_ACCENT}`, opacity }}
              />
            );
          })}
          <div style={{ width: 80, height: 80, borderRadius: "50%", backgroundColor: t.BAR_ACCENT }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 36 }}>
          <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "20px 28px", maxWidth: 950 }}>
            <BounceText text={caption} fontSize={54} color={t.CAPTION_FG} startFrame={30} stagger={2} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
