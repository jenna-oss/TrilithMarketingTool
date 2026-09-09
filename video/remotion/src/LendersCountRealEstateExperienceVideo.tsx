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

export const LendersCountRealEstateExperienceVideo: React.FC = () => {
  ensureFontsLoaded();
  const assets = (name: string) => staticFile(`lenders-count-real-estate-experience/${name}`);

  return (
    <TransitionSeries>
      {/* Beat 1 -- BuildList over the flip/renovation video, listing what actually counts */}
      <TransitionSeries.Sequence durationInFrames={s(8.84)}>
        <ExperienceListFullBleed
          videoSrc={assets("beat_1.mp4")}
          header="What Actually Counts"
          items={["Completed flips", "Ground-up builds", "Rental exits", "Refis into permanent financing"]}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-right" })} />

      {/* Beat 2 -- giant stat: the rolling lookback window */}
      <TransitionSeries.Sequence durationInFrames={s(6.78)}>
        <GiantStat text="24-36" label="month rolling lookback window" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-left" })} />

      {/* Beat 3 -- plain card statement, deals aging out */}
      <TransitionSeries.Sequence durationInFrames={s(4.11)}>
        <StatementCard
          eyebrow="THE CATCH"
          text="Deals outside that window age out — even if they're the reason you know what you're doing."
          fontSize={80}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={fade()} />

      {/* Beat 4 -- DocumentCard implying ownership/title paperwork */}
      <TransitionSeries.Sequence durationInFrames={s(7.49)}>
        <Card header="Prove the Stake" caption="Every deal you claim needs a verifiable ownership stake — on title or through the entity that held it." insetW={780} insetH={520} headerAlign="left">
          <DocumentCard
            source="Underwriting Guidelines"
            headline="Verifiable Ownership Required"
            body="Claimed deals must show a real ownership stake, either directly on title or through the entity that held it."
            highlightPhrase="a real ownership stake"
            width={780}
            height={520}
          />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={flip({ direction: "from-left" })} />

      {/* Beat 5 -- BuildList of what quietly doesn't count, struck through */}
      <TransitionSeries.Sequence durationInFrames={s(5.98)}>
        <StrikeList header="Quietly Doesn't Count" items={["Wholesale assignments", "GC work", "Passive fund investments"]} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={clockWipe({ width: 1080, height: 1920 })} />

      {/* Beat 6 -- twin split, owner-occupied reno vs partner deal, both tossed out, over renovation video */}
      <TransitionSeries.Sequence durationInFrames={s(6.76)}>
        <TwinSplitFullBleed
          videoSrc={assets("beat_6.mp4")}
          header="Also Tossed Out"
          left="Owner-occupied renovations"
          right="Partner deals with no entity paperwork"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-top" })} />

      {/* Beat 7 -- DocumentCard style chip list, proof types */}
      <TransitionSeries.Sequence durationInFrames={s(7.41)}>
        <Card header="What Proves It" caption="Settlement statements, recorded deeds, HUD-1s, operating agreements, permits, draw histories." insetW={800} insetH={560} headerAlign="left" captionFontSize={46}>
          <ProofChips items={["Settlement Statements", "Recorded Deeds", "HUD-1s", "Operating Agreements", "Permits", "Draw Histories"]} />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-left" })} />

      {/* Beat 8 -- card statement on hard money tier system */}
      <TransitionSeries.Sequence durationInFrames={s(5.91)}>
        <TierSystemFullBleed caption="Hard money lenders run this like a tier system — more documented deals unlocks better terms." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={flip({ direction: "from-right" })} />

      {/* Beat 9 -- dual giant stat, 90% purchase + 100% rehab, over contractor video */}
      <TransitionSeries.Sequence durationInFrames={s(7.12)}>
        <DualStatFullBleed
          videoSrc={assets("beat_9.mp4")}
          top={{ value: "90%", label: "of purchase price" }}
          bottom={{ value: "100%", label: "of a documented rehab budget" }}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-bottom" })} />

      {/* Beat 10 -- understated card statement, first-timer terms */}
      <TransitionSeries.Sequence durationInFrames={s(5.49)}>
        <StatementCard eyebrow="FIRST-TIMERS" text="20 to 30% down, plus bigger reserves in the bank." fontSize={74} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={fade()} />

      {/* Beat 11 -- bold statement full bleed over ground-up construction video */}
      <TransitionSeries.Sequence durationInFrames={s(6.36)}>
        <BoldStatementFullBleedVideo videoSrc={assets("beat_11.mp4")} eyebrow="THE GOOD NEWS" text="You're not locked out." caption="Flip loans and ground-up construction loans exist for first-timers too." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-bottom" })} />

      {/* Beat 12 -- step process, track record deprioritized -> property cash flow highlighted */}
      <TransitionSeries.Sequence durationInFrames={s(5.02)}>
        <DSCRStepProcess caption="DSCR loans barely care about your track record — the property's cash flow does the talking." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={clockWipe({ width: 1080, height: 1920 })} />

      {/* Beat 13 -- signal pulse closer */}
      <TransitionSeries.Sequence durationInFrames={s(7.51)}>
        <TakeawayClose header="Ask Yourself" caption="Is this documented in a way a lender can actually verify?" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

/** Beat 1 opener -- BuildList of what actually counts as experience, laid
 * over full-bleed flip/renovation footage with a dark gradient for
 * legibility, rather than the plain-BG BuildList used elsewhere -- this is
 * the cold open so it earns the real-footage treatment. */
const ExperienceListFullBleed: React.FC<{ videoSrc: string; header: string; items: string[] }> = ({ videoSrc, header, items }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,31,73,0.55) 0%, rgba(0,31,73,0.35) 45%, rgba(0,31,73,0.85) 100%)" }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ WebkitTextStroke: "0px", }}>
            <BounceText text={header} fontSize={82} color="#ffffff" startFrame={2} stagger={2.5} maxWidth={920} align="center" />
          </div>
          <div style={{ width: 200, height: 3, backgroundColor: t.BAR_ACCENT, marginTop: 26, marginBottom: 50 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            {items.map((item, i) => {
              const start = 16 + i * s(0.6);
              const opacity = interpolate(frame - start, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              if (opacity <= 0) return <div key={i} style={{ height: 62 }} />;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24, opacity }}>
                  <div style={{ width: 14, height: 14, backgroundColor: t.BAR_ACCENT }} />
                  <BounceText text={item} fontSize={52} color="#ffffff" align="left" startFrame={start} stagger={1.8} maxWidth={780} />
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A plain, no-imagery card statement -- an uppercase eyebrow above a
 * single bounced line, used for beats that should just sit heavy with no
 * competing visual (beat 3's "age out" line, beat 10's first-timer terms). */
const StatementCard: React.FC<{ eyebrow: string; text: string; fontSize: number }> = ({ eyebrow, text, fontSize }) => (
  <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center", alignItems: "center" }}>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 900 }}>
      <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 30, color: t.BAR_ACCENT, letterSpacing: 4, marginBottom: 34 }}>{eyebrow}</div>
      <BounceText text={text} fontSize={fontSize} color={t.INK} startFrame={6} stagger={2.5} align="center" maxWidth={900} />
    </div>
  </AbsoluteFill>
);

/** BuildList variant with each item struck through shortly after it lands
 * -- for the "quietly doesn't count" beat, so the list reads as things
 * being knocked out rather than things being built up. */
const StrikeList: React.FC<{ header: string; items: string[] }> = ({ header, items }) => {
  const frame = useCurrentFrame();
  const itemStagger = s(1.1);
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <BounceText text={header} fontSize={90} color={t.INK} startFrame={2} stagger={3} maxWidth={900} align="center" />
        <div style={{ width: 220, height: 3, backgroundColor: t.BAR_ACCENT, marginTop: 22, marginBottom: 56 }} />
        {items.map((item, i) => {
          const start = 20 + i * itemStagger;
          const opacity = interpolate(frame - start, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const strike = interpolate(frame - start - 14, [0, 10], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (opacity <= 0) return <div key={i} style={{ height: 94 }} />;
          return (
            <div key={i} style={{ position: "relative", opacity, marginBottom: 30 }}>
              <BounceText text={item} fontSize={62} color="#8a8a84" align="center" startFrame={start} stagger={2} maxWidth={780} />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: `${strike}%`,
                  height: 4,
                  backgroundColor: t.BAR_ACCENT,
                  transform: "translate(-50%, -50%)",
                }}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Full-bleed twin split over real renovation footage -- both halves
 * marked "tossed out" so it reads as a direct extension of beat 5's
 * strike-through treatment, just with imagery this time. */
const TwinSplitFullBleed: React.FC<{ videoSrc: string; header: string; left: string; right: string }> = ({ videoSrc, header, left, right }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,31,73,0.6) 0%, rgba(0,31,73,0.35) 40%, rgba(0,31,73,0.75) 100%)" }} />
      <AbsoluteFill style={{ justifyContent: "center" }}>
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 60 }}>
            <BounceText text={header} fontSize={74} color="#ffffff" startFrame={2} stagger={2.5} maxWidth={900} />
          </div>
          <div style={{ display: "flex" }}>
            <TossedHalf label={left} startFrame={6} />
            <div style={{ width: 2, backgroundColor: "rgba(255,255,255,0.35)", margin: "10px 0" }} />
            <TossedHalf label={right} startFrame={18} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const TossedHalf: React.FC<{ label: string; startFrame: number }> = ({ label, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame: frame - startFrame, fps, config: { damping: 14, stiffness: 130 } });
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 22px" }}>
      <div style={{ opacity: scale, transform: `scale(${0.85 + scale * 0.15})`, textAlign: "center" }}>
        <BounceText text={label} fontSize={40} color="#ffffff" align="center" startFrame={startFrame} stagger={2} maxWidth={340} />
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "inline-block", border: `1.5px solid ${t.BAR_ACCENT}`, borderRadius: 6, padding: "8px 16px", fontFamily: "AgencyFB-Bold", fontSize: 24, color: t.BAR_ACCENT, letterSpacing: 2 }}>
            TOSSED OUT
          </div>
        </div>
      </div>
    </div>
  );
};

/** Small chip grid used as a Card inset -- each proof-document type pops
 * in as its own chip rather than a plain bulleted list, for the "what
 * proves it" beat which names six document types. */
const ProofChips: React.FC<{ items: string[] }> = ({ items }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: t.INSET_BG, justifyContent: "center", alignItems: "center", padding: 40 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18, maxWidth: 700 }}>
        {items.map((item, i) => {
          const start = 4 + i * 8;
          const opacity = interpolate(frame - start, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const rise = interpolate(frame - start, [0, 8], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                opacity,
                transform: `translateY(${rise}px)`,
                backgroundColor: "#ffffff",
                border: `1.5px solid ${t.BAR_ACCENT}`,
                borderRadius: 8,
                padding: "14px 20px",
                fontFamily: "AgencyFB-Bold",
                fontSize: 30,
                color: t.INK,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Full-bleed tier ladder -- three ascending bars (Tier 1 to Tier 3) that
 * grow taller left to right, for the "hard money lenders run this like a
 * tier system" beat, so "tier system" gets a real visual instead of just
 * being said. */
const TierSystemFullBleed: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const tiers = [
    { label: "Tier 1", h: 140 },
    { label: "Tier 2", h: 220 },
    { label: "Tier 3", h: 300 },
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center" }}>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 60 }}>
          <BounceText text="A Tier System" fontSize={90} color={t.INK} startFrame={2} stagger={2.5} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 34, height: 340 }}>
          {tiers.map((tier, i) => {
            const start = 6 + i * 10;
            const p = interpolate(frame - start, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: 340 }}>
                <div style={{ width: 130, height: tier.h * p, backgroundColor: i === tiers.length - 1 ? t.BAR_ACCENT : t.INK }} />
                <div style={{ marginTop: 16, fontFamily: "AgencyFB-Bold", fontSize: 32, color: t.INK, opacity: p }}>{tier.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 60 }}>
          <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "20px 28px", maxWidth: 900 }}>
            <BounceText text={caption} fontSize={40} color={t.CAPTION_FG} startFrame={44} stagger={2.2} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Full-bleed dual giant stat over contractor/rehab-budget footage -- two
 * numerals stacked with their own labels, for the 90%/100% financing
 * terms beat. */
const DualStatFullBleed: React.FC<{ videoSrc: string; top: { value: string; label: string }; bottom: { value: string; label: string } }> = ({
  videoSrc,
  top,
  bottom,
}) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <OffthreadVideo src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,31,73,0.55) 0%, rgba(0,31,73,0.4) 45%, rgba(0,31,73,0.8) 100%)" }} />
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 60 }}>
        <StatBlock value={top.value} label={top.label} startFrame={2} />
        <StatBlock value={bottom.value} label={bottom.label} startFrame={18} />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

const StatBlock: React.FC<{ value: string; label: string; startFrame: number }> = ({ value, label, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sc = spring({ frame: frame - startFrame, fps, config: { damping: 14, stiffness: 130 } });
  return (
    <div style={{ textAlign: "center", opacity: sc, transform: `scale(${0.9 + sc * 0.1})` }}>
      <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 170, color: "#ffffff", lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: 12 }}>
        <BounceText text={label} fontSize={38} color="#ffffff" startFrame={startFrame + 10} stagger={2} maxWidth={680} align="center" />
      </div>
    </div>
  );
};

/** Full-bleed bold statement over ground-up construction footage, with a
 * short caption below -- mirrors the other videos' BoldStatementFullBleed
 * but with real video behind it since this is a reassuring/pivot beat
 * that earns imagery rather than pure typography. */
const BoldStatementFullBleedVideo: React.FC<{ videoSrc: string; eyebrow: string; text: string; caption: string }> = ({ videoSrc, eyebrow, text, caption }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <OffthreadVideo src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,31,73,0.5) 0%, rgba(0,31,73,0.3) 40%, rgba(0,31,73,0.82) 100%)" }} />
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 920 }}>
        <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 28, color: t.BAR_ACCENT, letterSpacing: 4, marginBottom: 30 }}>{eyebrow}</div>
        <BounceText text={text} fontSize={112} color="#ffffff" startFrame={6} stagger={2.5} align="center" maxWidth={880} />
        <div style={{ marginTop: 44 }}>
          <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "20px 28px", maxWidth: 900 }}>
            <BounceText text={caption} fontSize={38} color={t.CAPTION_FG} startFrame={40} stagger={2.2} align="center" />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

/** Step-process visual -- "track record" fades/deprioritizes into a
 * de-emphasized state while "property cash flow" pops in bold and large,
 * with an arrow between them, for the DSCR beat. */
const DSCRStepProcess: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const fadeOut = interpolate(frame, [0, 24], [1, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const arrowOpacity = interpolate(frame - 20, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const { fps } = useVideoConfig();
  const highlightScale = spring({ frame: frame - 30, fps, config: { damping: 13, stiffness: 140 } });
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ opacity: fadeOut, textAlign: "center" }}>
          <div style={{ fontFamily: "AgencyFB-Regular", fontSize: 24, color: "#8a8a84", letterSpacing: 3, marginBottom: 10 }}>DEPRIORITIZED</div>
          <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 56, color: "#8a8a84" }}>Your Track Record</div>
        </div>
        <div style={{ opacity: arrowOpacity, fontSize: 60, color: t.BAR_ACCENT, margin: "30px 0" }}>&#8595;</div>
        <div style={{ textAlign: "center", opacity: highlightScale, transform: `scale(${0.9 + highlightScale * 0.1})` }}>
          <div style={{ fontFamily: "AgencyFB-Regular", fontSize: 26, color: t.BAR_ACCENT, letterSpacing: 3, marginBottom: 12 }}>WHAT MATTERS</div>
          <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 90, color: t.INK, maxWidth: 800, textAlign: "center" }}>Property Cash Flow</div>
        </div>
        <div style={{ marginTop: 56 }}>
          <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "20px 28px", maxWidth: 900 }}>
            <BounceText text={caption} fontSize={38} color={t.CAPTION_FG} startFrame={50} stagger={2.2} align="center" />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Closer -- reuses the radar-style signal pulse from the JPMorgan/DSCR/
 * Construction closers, for visual consistency across the video series. */
const TakeawayClose: React.FC<{ header: string; caption: string }> = ({ header, caption }) => {
  const frame = useCurrentFrame();
  const RING_COUNT = 3;
  const RING_STAGGER = 16;
  const RING_LIFE = 40;
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center" }}>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 50 }}>
          <BounceText text={header} fontSize={100} color={t.INK} startFrame={2} stagger={2.5} maxWidth={950} />
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
                style={{ position: "absolute", width: size, height: size, borderRadius: "50%", border: `6px solid ${t.BAR_ACCENT}`, opacity }}
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
