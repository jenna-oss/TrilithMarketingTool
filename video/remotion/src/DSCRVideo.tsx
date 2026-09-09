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

export const DSCRVideo: React.FC = () => {
  ensureFontsLoaded();
  const assets = (name: string) => staticFile(`dscr/${name}`);

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={s(5.27)}>
        <WallStat caption="Most investors hit a wall at exactly 10 properties." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-right" })} />

      <TransitionSeries.Sequence durationInFrames={s(5.54)}>
        <BuildList header="The Real Reason" items={["Not the market", "Not your credit", "A hard rule banks don't explain"]} itemStaggerFrames={s(1)} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(6.15)}>
        <Card header="The Rule" caption="A hard cap on conventional financing — most investors don't learn it until they hit it." insetW={780} insetH={520} headerAlign="left">
          <DocumentCard
            source="Gustan Cho Associates"
            headline="Fannie Mae's Financed-Property Limit"
            body="Conventional financing caps out at 10 total financed properties per borrower — including the home you live in."
            highlightPhrase="10 total financed properties"
            width={780}
            height={520}
          />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={fade()} />

      <TransitionSeries.Sequence durationInFrames={s(5.3)}>
        <BoldStatementFullBleed eyebrow="THE FINE PRINT" text="Not won't. Legally can't." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-bottom" })} />

      <TransitionSeries.Sequence durationInFrames={s(5.21)}>
        <ShiftFullBleed videoSrc={assets("keys_handoff.mp4")} caption="This is why serious investors move to DSCR loans once they scale past a handful of properties." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={clockWipe({ width: 1080, height: 1920 })} />

      <TransitionSeries.Sequence durationInFrames={s(7.08)}>
        <DSCRDefinition />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-top" })} />

      <TransitionSeries.Sequence durationInFrames={s(3.82)}>
        <GiantStat text="1.0–1.25x" label="rent-to-mortgage ratio lenders want" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={flip({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(5.37)}>
        <CeilingComparison caption="The eleventh loan doesn't carry the weight of the first ten." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(5.25)}>
        <Card header="The Self-Employed Edge" caption="DSCR looks at the property's rent, not your personal income." insetW={780} insetH={520} headerAlign="left" bg="#faf9f5">
          <DocumentCard
            source="Pinnacle Funding Network"
            headline="Why DSCR Works for the Self-Employed"
            body="Write-offs that help at tax time don't get penalized when qualifying — the property's own rent is what's underwritten."
            highlightPhrase="don't get penalized when qualifying"
            width={780}
            height={520}
          />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={flip({ direction: "from-right" })} />

      <TransitionSeries.Sequence durationInFrames={s(5.63)}>
        <Card header="The Tradeoff" caption="The cost of skipping personal-income underwriting." insetW={700} insetH={460} headerAlign="left">
          <MiniStatStack
            rows={[
              { value: "Higher Rate", label: "than a conventional loan" },
              { value: "Higher Down Payment", label: "typically required" },
            ]}
          />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-bottom" })} />

      <TransitionSeries.Sequence durationInFrames={s(5.59)}>
        <BuildList
          header="The Recap"
          items={["10 properties: the conventional limit", "DSCR: no cap", "Each property qualifies on its own"]}
          itemStaggerFrames={s(1.1)}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={fade()} />

      <TransitionSeries.Sequence durationInFrames={s(6.8)}>
        <TakeawayClose
          header="Before It's Too Late"
          caption="If you're getting close to that number, this is the financing conversation to have before your tenth loan gets denied."
        />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

/** Opener -- "hitting a wall" as a pure motion gag: a solid wall panel
 * sits fixed on the right, and "10" rockets in from off-screen left,
 * slamming flat against it with a hard stop, a bit of recoil, a
 * screen-shake, an impact flash, and a couple of crack lines -- instead of
 * relying on any photo to sell "wall." */
const WallStat: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const IMPACT = 14;

  // fast approach, then a hard stop right at the wall with a small recoil bounce
  const approach = interpolate(frame, [0, IMPACT], [-900, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => x * x });
  const recoil = frame > IMPACT ? -interpolate(frame - IMPACT, [0, 5, 11], [0, 26, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const numX = frame <= IMPACT ? approach : recoil;

  const shake = frame >= IMPACT && frame < IMPACT + 8 ? (frame % 2 === 0 ? 10 : -10) : 0;
  const flash = interpolate(frame - IMPACT, [0, 2, 12], [1, 0.4, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const crackOpacity = interpolate(frame - IMPACT, [0, 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", transform: `translateX(${shake}px)` }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <div style={{ transform: `translateX(${numX}px)` }}>
            <BounceText text="10" fontSize={220} color={t.INK} startFrame={0} stagger={0} />
          </div>
          {/* the wall -- fixed in place, hazard-striped panel */}
          <div
            style={{
              width: 34,
              height: 240,
              marginLeft: 18,
              background: "repeating-linear-gradient(45deg, #f4c542, #f4c542 14px, #141414 14px, #141414 28px)",
              boxShadow: "6px 0 18px rgba(0,0,0,0.25)",
              position: "relative",
            }}
          >
            <svg width="34" height="240" style={{ position: "absolute", top: 0, left: 0, opacity: crackOpacity }}>
              <path d="M 17 40 L 4 80 L 22 110 L 8 160" stroke="#fff" strokeWidth={2} fill="none" opacity={0.8} />
              <path d="M 17 150 L 28 190 L 14 220" stroke="#fff" strokeWidth={2} fill="none" opacity={0.6} />
            </svg>
          </div>
          <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash * 0.5, pointerEvents: "none" }} />
        </div>
        <div style={{ marginTop: 30 }}>
          <BounceText text="financed properties" fontSize={38} color="#5a5a5a" startFrame={IMPACT + 6} stagger={2} />
        </div>
        <div style={{ marginTop: 40 }}>
          <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "18px 26px", maxWidth: 780 }}>
            <BounceText text={caption} fontSize={38} color={t.CAPTION_FG} startFrame={IMPACT + 14} stagger={2} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Full-bleed real-video moment (keys handoff) with a stroke-outline
 * caption overlay -- same treatment as the Mayweather video's frame-05
 * beat, added here so the DSCR video isn't 100% graphics/text like the
 * first pass was. */
const ShiftFullBleed: React.FC<{ videoSrc: string; caption: string }> = ({ videoSrc, caption }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <OffthreadVideo src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.7) 100%)" }} />
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 220, paddingLeft: 70, paddingRight: 70 }}>
      <div style={{ WebkitTextStroke: "7px #000", paintOrder: "stroke fill" }}>
        <BounceText text={caption} fontSize={50} color="#ffffff" maxWidth={920} stagger={2.2} align="center" />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

/** Full-bleed bold-statement beat -- a small uppercase eyebrow label above
 * one giant bounced statement, no card box, for the "here's the fine
 * print" beat so it reads as authorial commentary rather than a fact
 * card. */
const BoldStatementFullBleed: React.FC<{ eyebrow: string; text: string }> = ({ eyebrow, text }) => (
  <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center", alignItems: "center" }}>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 920 }}>
      <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 30, color: t.BAR_ACCENT, letterSpacing: 4, marginBottom: 30 }}>{eyebrow}</div>
      <BounceText text={text} fontSize={80} color={t.INK} startFrame={6} stagger={2.5} align="center" maxWidth={920} />
    </div>
  </AbsoluteFill>
);

/** Small stat-stack used as a Card inset -- reused pattern from the
 * JPMorgan video's MiniStatStack. */
const MiniStatStack: React.FC<{ rows: { value: string; label: string }[] }> = ({ rows }) => (
  <AbsoluteFill style={{ backgroundColor: t.INSET_BG, justifyContent: "center", alignItems: "center" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ textAlign: "center" }}>
          <BounceText text={row.value} fontSize={56} color={t.INK} startFrame={4 + i * 14} stagger={2.5} />
          <div style={{ marginTop: 6 }}>
            <BounceText text={row.label} fontSize={28} color="#5a5a5a" startFrame={10 + i * 14} stagger={2} />
          </div>
        </div>
      ))}
    </div>
  </AbsoluteFill>
);

/** Full-bleed acronym reveal -- "DSCR" expands letter by letter into its
 * full name, then lands on the plain-English question it actually asks.
 * Makes the definition beat visceral instead of just narrating it over a
 * card. */
const DSCRDefinition: React.FC = () => {
  const frame = useCurrentFrame();
  const letters = [
    { l: "D", word: "Debt" },
    { l: "S", word: "Service" },
    { l: "C", word: "Coverage" },
    { l: "R", word: "Ratio" },
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 900 }}>
        <div style={{ display: "flex", gap: 28 }}>
          {letters.map((item, i) => {
            const start = 4 + i * 16;
            const opacity = interpolate(frame - start, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={i} style={{ textAlign: "center", opacity }}>
                <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 110, color: t.BAR_ACCENT, lineHeight: 1 }}>{item.l}</div>
                <div style={{ fontFamily: "AgencyFB-Regular", fontSize: 26, color: "#5a5a5a", marginTop: 6 }}>{item.word}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 60 }}>
          <BounceText text="Does the rent cover the mortgage?" fontSize={58} color={t.INK} startFrame={78} stagger={2.5} align="center" maxWidth={820} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Full-bleed twin comparison -- the 10th (conventional) loan blocked in
 * dark, the 11th (DSCR) loan approved in accent gold, callback to the
 * opener's "wall" visual so the payoff reads as a direct answer to it. */
const CeilingComparison: React.FC<{ caption: string }> = ({ caption }) => (
  <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center" }}>
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 60 }}>
        <BounceText text="No Ceiling" fontSize={80} color={t.INK} startFrame={2} stagger={2.5} />
      </div>
      <div style={{ display: "flex" }}>
        <CeilingHalf label="10th Loan" status="Blocked" bg={t.BAR_COLOR} fg="#ffffff" startFrame={4} />
        <div style={{ width: 2, backgroundColor: "#d8d8d3", margin: "10px 0" }} />
        <CeilingHalf label="11th Loan" status="DSCR: Approved" bg={t.BAR_ACCENT} fg="#141414" startFrame={16} />
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 60 }}>
        <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "20px 28px", maxWidth: 900 }}>
          <BounceText text={caption} fontSize={38} color={t.CAPTION_FG} startFrame={30} stagger={2.2} />
        </div>
      </div>
    </div>
  </AbsoluteFill>
);

const CeilingHalf: React.FC<{ label: string; status: string; bg: string; fg: string; startFrame: number; bgImage?: string }> = ({
  label,
  status,
  bg,
  fg,
  startFrame,
  bgImage,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame: frame - startFrame, fps, config: { damping: 14, stiffness: 130 } });
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
      <div
        style={{
          opacity: scale,
          transform: `scale(${0.85 + scale * 0.15})`,
          position: "relative",
          overflow: "hidden",
          backgroundColor: bg,
          color: fg,
          textAlign: "center",
          padding: "34px 24px",
          width: "100%",
        }}
      >
        {bgImage && <img src={bgImage} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.35 }} />}
        <div style={{ position: "relative", fontFamily: "AgencyFB-Bold", fontSize: 40 }}>{label}</div>
        <div style={{ position: "relative", fontFamily: "AgencyFB-Regular", fontSize: 26, marginTop: 8, opacity: 0.85 }}>{status}</div>
      </div>
    </div>
  );
};

/** Closer -- reuses the radar-style signal pulse built for the JPMorgan
 * video's closing beat (a growth bar/chart doesn't fit a CTA about timing
 * a conversation, but a pulse/signal does). */
const TakeawayClose: React.FC<{ header: string; caption: string }> = ({ header, caption }) => {
  const frame = useCurrentFrame();
  const RING_COUNT = 3;
  const RING_STAGGER = 16;
  const RING_LIFE = 40;
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center" }}>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 50 }}>
          <BounceText text={header} fontSize={80} color={t.INK} startFrame={2} stagger={2.5} maxWidth={950} />
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
            <BounceText text={caption} fontSize={40} color={t.CAPTION_FG} startFrame={30} stagger={2} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
