import React from "react";
import { AbsoluteFill, staticFile, OffthreadVideo, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { Card } from "./components/Card";
import { BuildList } from "./components/BuildList";
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

export const ConstructionVideo: React.FC = () => {
  ensureFontsLoaded();
  const assets = (name: string) => staticFile(`construction/${name}`);

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={s(3.68)}>
        <OpeningFullBleed videoSrc={assets("site_video.mp4")} headline="You don't need experience to get a construction loan." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-right" })} />

      <TransitionSeries.Sequence durationInFrames={s(5.24)}>
        <Card header="The Real Test" caption="The lender isn't worried about the house — it's worried about everything that has to happen before it exists." insetW={620} insetH={780} headerAlign="left" headerSize={130} captionFontSize={68}>
          <ZoomPanImage src={assets("blueprint.jpg")} durationInFrames={s(5.24)} pan="top-to-bottom" />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(4.73)}>
        <BuildList
          header="What Gets Evaluated"
          items={["A credible contractor", "A realistic schedule", "A plan that matches the budget", "A real exit strategy"]}
          itemStaggerFrames={s(1)}
          headerFontSize={130}
          itemFontSize={78}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={fade()} />

      <TransitionSeries.Sequence durationInFrames={s(3.11)}>
        <Card header="The Hidden Budget" caption="Real costs go beyond the build itself." insetW={720} insetH={480} headerAlign="left" headerSize={120} captionFontSize={66}>
          <ChecklistInset items={["Site work & utilities", "Permits & insurance", "Interest & carrying costs", "Contingency reserve"]} />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-bottom" })} />

      <TransitionSeries.Sequence durationInFrames={s(5.4)}>
        <BoldStatementFullBleed eyebrow="THE MYTH" text="An understated allowance doesn't save money. It only postpones the invoice." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={clockWipe({ width: 1080, height: 1920 })} />

      <TransitionSeries.Sequence durationInFrames={s(6.32)}>
        <DrawScheduleFullBleed
          steps={["Work Completed", "Draw Requested", "Inspection", "Funds Released"]}
          caption="Funds release in stages — not all at once."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-top" })} />

      <TransitionSeries.Sequence durationInFrames={s(4.31)}>
        <Card header="The Cash Flow Gap" caption="Loan-to-cost tells you the percentage. It doesn't tell you what you need this week." insetW={700} insetH={460} headerAlign="left" headerSize={120} captionFontSize={64}>
          <MiniStatStack
            rows={[
              { value: "LTC %", label: "what the loan covers" },
              { value: "This Week", label: "what you actually owe" },
            ]}
          />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={flip({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(5.63)}>
        <TwoPathsSplit
          header="Two Paths"
          caption="Know your exit before you break ground."
          left={{ title: "Build to Sell", lines: ["Realistic comps", "Selling costs", "Margin buffer"] }}
          right={{ title: "Build to Rent", lines: ["Supportable rent", "Operating costs", "Stabilization time"] }}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(5.19)}>
        <BoldStatementFullBleed eyebrow="THE RED FLAG" text="Perfect weather. Zero change orders. A record sale price. That's not a plan." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={flip({ direction: "from-right" })} />

      <TransitionSeries.Sequence durationInFrames={s(5.11)}>
        <BuildList
          header="The Good First Deal"
          items={["A proven product type", "A supportable value", "A manageable scope", "Few unresolved questions"]}
          itemStaggerFrames={s(1)}
          headerFontSize={130}
          itemFontSize={78}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-bottom" })} />

      <TransitionSeries.Sequence durationInFrames={s(4.05)}>
        <RecapFullBleed lines={["Plan beats experience", "Budget beyond the build", "Know your exit"]} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={fade()} />

      <TransitionSeries.Sequence durationInFrames={s(6.72)}>
        <TakeawayClose
          header="The Takeaway"
          caption="The first build becomes financeable when the plan makes the missing track record less important."
        />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

/** Opener -- full-bleed real construction-site footage, dark gradient for
 * legibility, bold stroke-outline headline anchored to the bottom (same
 * treatment used for the other videos' cold opens). */
const OpeningFullBleed: React.FC<{ videoSrc: string; headline: string }> = ({ videoSrc, headline }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <OffthreadVideo src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.75) 100%)" }} />
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 260, paddingLeft: 70, paddingRight: 70 }}>
      <div style={{ WebkitTextStroke: "15px #000", paintOrder: "stroke fill" }}>
        <BounceText text={headline} fontSize={130} color="#ffffff" maxWidth={990} stagger={2.5} align="center" />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

/** Small Card inset -- a plain checklist, for beats that list several
 * short cost/requirement items without needing a chart or document. */
const ChecklistInset: React.FC<{ items: string[] }> = ({ items }) => (
  <AbsoluteFill style={{ backgroundColor: t.INSET_BG, justifyContent: "center", alignItems: "flex-start", padding: "0 50px" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 20, height: 20, backgroundColor: t.BAR_ACCENT }} />
          <BounceText text={item} fontSize={60} color={t.INK} align="left" startFrame={4 + i * 10} stagger={1.8} maxWidth={600} />
        </div>
      ))}
    </div>
  </AbsoluteFill>
);

/** Small stat-stack used as a Card inset -- reused pattern from the
 * JPMorgan/DSCR videos. */
const MiniStatStack: React.FC<{ rows: { value: string; label: string }[] }> = ({ rows }) => (
  <AbsoluteFill style={{ backgroundColor: t.INSET_BG, justifyContent: "center", alignItems: "center" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ textAlign: "center" }}>
          <BounceText text={row.value} fontSize={96} color={t.INK} startFrame={4 + i * 14} stagger={2.5} />
          <div style={{ marginTop: 10 }}>
            <BounceText text={row.label} fontSize={44} color="#5a5a5a" startFrame={10 + i * 14} stagger={2} />
          </div>
        </div>
      ))}
    </div>
  </AbsoluteFill>
);

/** Full-bleed bold-statement beat -- a small uppercase eyebrow label above
 * one giant bounced statement, no card box, for the "myth" and "red flag"
 * beats so they read as authorial commentary. */
const BoldStatementFullBleed: React.FC<{ eyebrow: string; text: string }> = ({ eyebrow, text }) => (
  <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center", alignItems: "center" }}>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 920 }}>
      <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 48, color: t.BAR_ACCENT, letterSpacing: 4, marginBottom: 40 }}>{eyebrow}</div>
      <BounceText text={text} fontSize={118} color={t.INK} startFrame={6} stagger={2.5} align="center" maxWidth={990} />
    </div>
  </AbsoluteFill>
);

/** Full-bleed 4-step process reveal -- each step pops in connected by a
 * vertical line, for the draw-schedule beat so the sequence reads as a
 * real process instead of a plain bullet list. */
const DrawScheduleFullBleed: React.FC<{ steps: string[]; caption: string }> = ({ steps, caption }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center" }}>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 50 }}>
          <BounceText text="The Draw Schedule" fontSize={116} color={t.INK} startFrame={2} stagger={2.5} maxWidth={990} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0, paddingLeft: 70 }}>
          {steps.map((step, i) => {
            const start = 10 + i * 16;
            const opacity = interpolate(frame - start, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const x = interpolate(frame - start, [0, 10], [-30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 30, height: 118, opacity, transform: `translateX(${x}px)` }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 68, height: 68, borderRadius: "50%", backgroundColor: t.BAR_ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "AgencyFB-Bold", fontSize: 40, color: "#141414" }}>
                    {i + 1}
                  </div>
                  {i < steps.length - 1 && <div style={{ width: 5, height: 50, backgroundColor: "#d8d8d3" }} />}
                </div>
                <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 72, color: t.INK }}>{step}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 50 }}>
          <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "20px 28px", maxWidth: 950 }}>
            <BounceText text={caption} fontSize={58} color={t.CAPTION_FG} startFrame={10 + steps.length * 16 + 6} stagger={2.2} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Full-bleed twin-path split -- each side gets a title and a short list
 * of what it needs, for the build-to-sell vs build-to-rent fork. */
const TwoPathsSplit: React.FC<{
  header: string;
  caption: string;
  left: { title: string; lines: string[] };
  right: { title: string; lines: string[] };
}> = ({ header, caption, left, right }) => (
  <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center" }}>
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 50 }}>
        <BounceText text={header} fontSize={126} color={t.INK} startFrame={2} stagger={2.5} />
      </div>
      <div style={{ display: "flex" }}>
        <PathHalf {...left} startFrame={4} />
        <div style={{ width: 2, backgroundColor: "#d8d8d3", margin: "10px 0" }} />
        <PathHalf {...right} startFrame={16} />
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 50 }}>
        <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "20px 28px", maxWidth: 950 }}>
          <BounceText text={caption} fontSize={54} color={t.CAPTION_FG} startFrame={28} stagger={2.2} />
        </div>
      </div>
    </div>
  </AbsoluteFill>
);

const PathHalf: React.FC<{ title: string; lines: string[]; startFrame: number }> = ({ title, lines, startFrame }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "0 20px" }}>
    <BounceText text={title} fontSize={62} color={t.BAR_ACCENT} startFrame={startFrame} stagger={2} align="center" maxWidth={380} />
    {lines.map((line, i) => (
      <BounceText key={i} text={line} fontSize={40} color="#5a5a5a" startFrame={startFrame + 10 + i * 8} stagger={1.8} align="center" maxWidth={360} />
    ))}
  </div>
);

/** Full-bleed plain recap -- a short stack of bounced lines, deliberately
 * NOT another BuildList (this video already uses BuildList twice) so the
 * recap reads as a distinct beat rather than a third numbered list. */
const RecapFullBleed: React.FC<{ lines: string[] }> = ({ lines }) => (
  <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center", alignItems: "center" }}>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
      <BounceText text="The Recap" fontSize={126} color={t.INK} startFrame={2} stagger={2.5} />
      {lines.map((line, i) => (
        <BounceText key={i} text={line} fontSize={76} color="#5a5a5a" startFrame={20 + i * 14} stagger={2} align="center" maxWidth={880} />
      ))}
    </div>
  </AbsoluteFill>
);

/** Closer -- reuses the radar-style signal pulse from the JPMorgan/DSCR
 * closers, for visual consistency across the whole video series. */
const TakeawayClose: React.FC<{ header: string; caption: string }> = ({ header, caption }) => {
  const frame = useCurrentFrame();
  const RING_COUNT = 3;
  const RING_STAGGER = 16;
  const RING_LIFE = 40;
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center" }}>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 50 }}>
          <BounceText text={header} fontSize={126} color={t.INK} startFrame={2} stagger={2.5} maxWidth={990} />
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
          <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "22px 30px", maxWidth: 980 }}>
            <BounceText text={caption} fontSize={60} color={t.CAPTION_FG} startFrame={30} stagger={2} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
