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
import { BarChart } from "./components/BarChart";
import { PieChart } from "./components/PieChart";
import { BuildList } from "./components/BuildList";
import { CelebrityIntro } from "./components/CelebrityIntro";
import { DocumentCard } from "./components/DocumentCard";
import { BounceText } from "./components/BounceText";
import { ensureFontsLoaded } from "./fonts";
import * as t from "./tokens";

const FPS = 30;
const SWIPE = Math.round(0.35 * FPS);

const s = (seconds: number) => Math.round(seconds * FPS);

/** Zoom+pan wrapper for a static image, replacing ffmpeg zoompan -- driven
 * by frame directly so it composites naturally with any overlay content. */
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
      <img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${tx}, ${ty})`,
        }}
      />
    </div>
  );
};

export const MayweatherVideo: React.FC = () => {
  ensureFontsLoaded();
  const assets = (name: string) => staticFile(`mayweather/${name}`);

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={s(2.5)}>
        <CelebrityIntro
          headline="Floyd Mayweather just put $100 million into a real estate deal worth $3 billion."
          highlightPhrase="Floyd Mayweather"
          cutoutSrc={assets("mayweather_cutout.png")}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-right" })} />

      <TransitionSeries.Sequence durationInFrames={s(4.5)}>
        <Card
          header="The Leverage Principle"
          caption="$100 million into a $3 billion portfolio — that's leverage at a scale most people never see."
          insetW={760}
          insetH={540}
          headerAlign="left"
          headerSize={66}
        >
          <BarChart
            width={760}
            height={540}
            maxValue={3000}
            bars={[
              { label: "Mayweather", value: 100, display: "$100M", startFrame: 0, durationFrames: 18 },
              { label: "Full portfolio", value: 3000, display: "$3B", accent: true, startFrame: 4, durationFrames: 24 },
            ]}
          />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(5)}>
        <PartnershipSplit
          header="The Partnership"
          caption="Joint venture with Go Partners — Meyer Orbach and Josh Gotlib — through Vada Properties."
          labels={["Mayweather's firm", "The operating partner"]}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={fade()} />

      <TransitionSeries.Sequence durationInFrames={s(4.5)}>
        <Card
          header="The Anchor Asset"
          caption="The Copper: twin towers in Murray Hill with 761 units — bought for $850 million in 2021."
          insetW={580}
          insetH={800}
          headerAlign="left"
        >
          <ZoomPanImage src={assets("frame_04_photo.jpg")} durationInFrames={s(4.5)} pan="top-to-bottom" />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-bottom" })} />

      <TransitionSeries.Sequence durationInFrames={s(4)}>
        <AbsoluteFill>
          <OffthreadVideo src={assets("frame_05_video.mp4")} startFrom={s(2)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 420 }}>
            <div style={{ WebkitTextStroke: "9px #000", paintOrder: "stroke fill" }}>
              <BounceText text="Four more buildings from Sheldon Solow's holdings — $1.7 billion" fontSize={54} color="#ffffff" maxWidth={950} stagger={2.5} />
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={clockWipe({ width: 1080, height: 1920 })} />

      <TransitionSeries.Sequence durationInFrames={s(3)}>
        <GiantStat text="$3 Billion" label="NYC real estate portfolio" targetValue={3} prefix="$" countDurationFrames={s(1)} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={flip({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(4.5)}>
        <Card
          header="The Capital Structure"
          caption="$100 million is about 3% of that total. The other 97% comes from other equity partners and mortgage debt."
          insetW={780}
          insetH={580}
          captionPosition="above"
        >
          <PieChart
            width={780}
            height={580}
            sweepDurationFrames={s(0.9)}
            slices={[
              { label: "Mayweather's $100M", value: 3, color: t.BAR_ACCENT },
              { label: "Other equity + debt", value: 97, color: t.BAR_COLOR },
            ]}
          />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={slide({ direction: "from-left" })} />

      <TransitionSeries.Sequence durationInFrames={s(5)}>
        <ScaleComparisonFullBleed
          header="Same Math, Bigger Scale"
          caption="That's the same leverage principle behind a $20,000 down payment on a $400,000 house — just multiplied to institutional scale."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-top" })} />

      <TransitionSeries.Sequence durationInFrames={s(4.5)}>
        <GiantStat text="$560 Million" label="career boxing earnings" targetValue={560} prefix="$" countDurationFrames={s(1)} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={fade()} />

      <TransitionSeries.Sequence durationInFrames={s(4.5)}>
        <Card
          header="What's Public"
          caption="His exact ownership stake in the joint venture has never been made public — only the $100 million contribution and the portfolio's total value."
          insetW={700}
          insetH={520}
          headerAlign="left"
          bg="#faf9f5"
        >
          <DocumentCard
            source="CRE Daily"
            headline="Mayweather Invests $100M in Real Estate Joint Venture"
            body="His exact ownership stake was never disclosed — only the $100 million contribution and the portfolio's $3 billion total value became public."
            highlightPhrase="$100 million contribution"
            width={700}
            height={520}
          />
        </Card>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={flip({ direction: "from-right" })} />

      <TransitionSeries.Sequence durationInFrames={s(4.5)}>
        <BuildList
          header="The Summary"
          items={["$100 million in", "$3 billion portfolio", "Roughly 3% of the total — the rest is leverage"]}
          itemStaggerFrames={s(1.1)}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: SWIPE })} presentation={wipe({ direction: "from-bottom" })} />

      <TransitionSeries.Sequence durationInFrames={s(5.5)}>
        <TakeawayFullBleed />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

/** Frame 3 replacement -- two color-blocked halves instead of a small
 * bordered card, with each side's name sliding in from its own edge. */
const PartnershipSplit: React.FC<{ header: string; caption: string; labels: [string, string] }> = ({ header, caption, labels }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const leftS = spring({ frame: frame - 6, fps, config: { damping: 14, stiffness: 130 } });
  const rightS = spring({ frame: frame - 12, fps, config: { damping: 14, stiffness: 130 } });
  const plusOpacity = interpolate(frame - 20, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center" }}>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 50 }}>
          <BounceText text={header} fontSize={82} color={t.INK} startFrame={2} stagger={2.5} />
        </div>
        <div style={{ height: 560, display: "flex" }}>
          <div
            style={{
              flex: 1,
              backgroundColor: t.BAR_COLOR,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: leftS,
              transform: `translateX(${(1 - leftS) * -80}px)`,
            }}
          >
            <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 52, color: "#fff", textAlign: "center", padding: "0 40px" }}>{labels[0]}</div>
          </div>
          <div style={{ width: 80, display: "flex", alignItems: "center", justifyContent: "center", opacity: plusOpacity }}>
            <span style={{ fontFamily: "AgencyFB-Bold", fontSize: 56, color: t.INK }}>+</span>
          </div>
          <div
            style={{
              flex: 1,
              backgroundColor: t.BAR_ACCENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: rightS,
              transform: `translateX(${(1 - rightS) * 80}px)`,
            }}
          >
            <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 52, color: "#141414", textAlign: "center", padding: "0 40px" }}>{labels[1]}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 50 }}>
          <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "20px 28px", maxWidth: 900 }}>
            <BounceText text={caption} fontSize={40} color={t.CAPTION_FG} startFrame={26} stagger={2.2} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Frame 8 replacement -- full-bleed comparison, huge numbers, no white
 * card box, header/caption floated directly on the page. */
const ScaleComparisonFullBleed: React.FC<{ header: string; caption: string }> = ({ header, caption }) => {
  const frame = useCurrentFrame();
  const p1 = Math.min(1, frame / 21);
  const p2 = Math.min(1, Math.max(0, (frame - 7) / 21));
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center" }}>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 50 }}>
          <BounceText text={header} fontSize={64} color={t.INK} startFrame={2} stagger={2.5} maxWidth={950} />
        </div>
        <div style={{ height: 620, display: "flex" }}>
          <Half title="Everyday" amount={`$${Math.round(20000 * p1).toLocaleString()}`} line1="down" line2="on a" amount2={`$${Math.round(400000 * p1).toLocaleString()}`} line3="house" />
          <div style={{ width: 2, backgroundColor: "#d8d8d3", margin: "40px 0" }} />
          <Half title="Institutional" amount={`$${Math.round(100 * p2)}M`} line1="stake" line2="in a" amount2={`$${(p2 * 3).toFixed(p2 >= 1 ? 0 : 1)}B`} line3="portfolio" />
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 50 }}>
          <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "20px 28px", maxWidth: 900 }}>
            <BounceText text={caption} fontSize={40} color={t.CAPTION_FG} startFrame={22} stagger={2.2} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Half: React.FC<{ title: string; line1: string; amount: string; line2: string; amount2: string; line3: string }> = ({
  title,
  line1,
  amount,
  line2,
  amount2,
  line3,
}) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "AgencyFB-Regular" }}>
    <div style={{ fontSize: 30, color: "#787878" }}>{title}</div>
    <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 68, color: "#141414" }}>{amount}</div>
    <div style={{ fontSize: 30, color: "#505050" }}>{line1}</div>
    <div style={{ fontSize: 30, color: "#787878", marginTop: 16 }}>{line2}</div>
    <div style={{ fontFamily: "AgencyFB-Bold", fontSize: 68, color: "#141414" }}>{amount2}</div>
    <div style={{ fontSize: 30, color: "#505050" }}>{line3}</div>
  </div>
);

/** Frame 12 replacement -- full-bleed, much bigger stacked bar, huge
 * closing caption instead of a small bordered card. */
const TakeawayFullBleed: React.FC = () => {
  const frame = useCurrentFrame();
  const pEquity = Math.min(1, frame / 16);
  const pDebt = Math.min(1, Math.max(0, (frame - 13) / 16));
  const equityH = 160 * pEquity;
  const debtH = 320 * pDebt;
  return (
    <AbsoluteFill style={{ backgroundColor: t.BG, justifyContent: "center" }}>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 50 }}>
          <BounceText text="The Takeaway" fontSize={96} color={t.INK} startFrame={2} stagger={2.5} />
        </div>
        <div style={{ position: "relative", width: "100%", height: 500 }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              width: 320,
              bottom: 0,
              height: equityH,
              backgroundColor: t.BAR_ACCENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {pEquity >= 1 && <span style={{ fontFamily: "AgencyFB-Bold", fontSize: 46 }}>Equity</span>}
          </div>
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              width: 320,
              bottom: equityH,
              height: debtH,
              backgroundColor: t.BAR_COLOR,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {pDebt >= 1 && <span style={{ fontFamily: "AgencyFB-Bold", fontSize: 46 }}>Debt</span>}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 50 }}>
          <div style={{ backgroundColor: t.CAPTION_BG, borderRadius: 8, padding: "22px 30px", maxWidth: 950 }}>
            <BounceText
              text="You don't need $100 million to use this. Understanding how equity partners and debt combine is what lets any investor control more than their own cash could buy."
              fontSize={44}
              color={t.CAPTION_FG}
              startFrame={30}
              stagger={2}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
