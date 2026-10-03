import type { CSSProperties, ReactNode } from "react";
import { contrastRatio } from "@/lib/public/color";
import { GRAPHIC_FONT } from "./assets";
import type { GraphicBrand, GraphicTableRow } from "./model";

/**
 * Shared building blocks for the PNG graphics. `next/og` (Satori) supports only a flexbox
 * subset of CSS: every element with more than one child needs `display: flex`, and text
 * is always a single string child.
 */

export type Logos = { org: string | null; competition: string | null; sponsors: (string | null)[] };

export const GOOD = "#1B7F3B";
export const BAD = "#D0312D";

/** Mix two #RRGGBB colours; t = 0 gives `a`, 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${ca.map((v, i) => Math.round(v + (cb[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Upper-case for single-line text. Spaces become no-break spaces: Satori kerns across a
 * normal space unevenly ("VALLEY  VIPERS"), but not across U+00A0.
 */
export const upper = (s: string) => s.toLocaleUpperCase("en-ZA").replace(/ /g, "\u00A0");

/** Greedy word wrap to at most `maxChars` characters per line (a long word gets its own line). */
export function wrapLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/**
 * Largest font size (≤ max) at which the longest word of \`text\` fits in \`width\` px, so a name
 * wraps between words, never inside one. \`charEm\`: average caps width in em (see \`Words\`).
 */
export function fitFontSize(text: string, width: number, max: number, charEm = 0.46): number {
  const longest = Math.max(1, ...text.split(/\s+/).map((w) => w.length));
  return Math.min(max, Math.floor(width / (longest * charEm)));
}

/**
 * Upper-case text that may wrap within `width` px. Lines are broken here rather than by
 * Satori so each line can use no-break spaces (see `upper`). `charEm` is the average
 * character width in em (Barlow Condensed caps are ~0.4em, plus any letter-spacing).
 */
export function Words({
  text,
  style,
  width,
  justify = "center",
  charEm = 0.44,
}: {
  text: string;
  style: CSSProperties;
  width: number;
  justify?: "center" | "flex-start" | "flex-end";
  charEm?: number;
}) {
  const size = typeof style.fontSize === "number" ? style.fontSize : 20;
  const lines = wrapLines(text.toLocaleUpperCase("en-ZA"), Math.max(4, Math.floor(width / (size * charEm))));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: justify, ...style }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: "flex" }}>
          {line.replace(/ /g, "\u00A0")}
        </div>
      ))}
    </div>
  );
}

/** The secondary colour when it reads on white, otherwise the primary (for text accents). */
export function accentOf(brand: GraphicBrand): string {
  return contrastRatio(brand.colors.secondary, "#FFFFFF") >= 3 ? brand.colors.secondary : brand.colors.primary;
}

/** Full-bleed background: a clean light gradient with brand-coloured corner stripes. */
export function Frame({ brand, children }: { brand: GraphicBrand; children: ReactNode }) {
  const { primary, secondary, text } = brand.colors;
  const stripe = (style: CSSProperties) => <div style={{ position: "absolute", display: "flex", ...style }} />;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        fontFamily: GRAPHIC_FONT,
        color: text,
        backgroundImage: `linear-gradient(180deg, #FFFFFF 0%, #F1F2EF 55%, ${mix(secondary, "#FFFFFF", 0.82)} 100%)`,
        overflow: "hidden",
      }}
    >
      {stripe({ top: -120, left: -150, width: 420, height: 60, backgroundColor: primary, transform: "rotate(-45deg)" })}
      {stripe({ top: -60, left: -150, width: 420, height: 16, backgroundColor: secondary, transform: "rotate(-45deg)" })}
      {stripe({ top: -120, right: -150, width: 420, height: 60, backgroundColor: primary, transform: "rotate(45deg)" })}
      {stripe({ top: -60, right: -150, width: 420, height: 16, backgroundColor: secondary, transform: "rotate(45deg)" })}
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", position: "relative" }}>
        {children}
      </div>
    </div>
  );
}

/** The organisation's logo, or a bold text lockup of its name when no logo is supplied. */
function OrgLockup({ brand, logo, height }: { brand: GraphicBrand; logo: string | null; height: number }) {
  const { primary, secondary } = brand.colors;
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element -- Satori, not the DOM
    return <img src={logo} alt="" height={height} style={{ height, maxWidth: height * 2.8, objectFit: "contain" }} />;
  }
  const words = upper(brand.orgName).split(/\s+/);
  const last = words.length > 1 ? words.pop()! : "";
  const lines: string[] = [];
  for (const w of words) {
    const prev = lines.at(-1);
    if (prev !== undefined && (prev + " " + w).length <= 11) lines[lines.length - 1] = `${prev}\u00A0${w}`;
    else lines.push(w);
  }
  const unit = height / (lines.length * 1.05 + 1.9);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height,
        padding: `0 ${unit * 0.9}px`,
        backgroundColor: primary,
        borderRadius: unit * 0.3,
        transform: "rotate(-3deg)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
      }}
    >
      {lines.map((l, i) => (
        <div key={i} style={{ display: "flex", color: "#FFFFFF", fontSize: unit * 0.95, fontWeight: 800, lineHeight: 1.05, letterSpacing: 1 }}>
          {l}
        </div>
      ))}
      {last ? (
        <div style={{ display: "flex", color: mix(secondary, "#FFFFFF", 0.35), fontSize: unit * 1.75, fontWeight: 800, lineHeight: 1 }}>{last}</div>
      ) : null}
    </div>
  );
}

/** The competition's logo, or a round badge with its name and slogan. */
function CompetitionLockup({ brand, logo, height }: { brand: GraphicBrand; logo: string | null; height: number }) {
  const { primary, secondary } = brand.colors;
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element -- Satori, not the DOM
    return <img src={logo} alt="" height={height} style={{ height, maxWidth: height * 1.6, objectFit: "contain" }} />;
  }
  const words = upper(brand.competitionName).split(/\s+/);
  const lines: string[] = [];
  for (const w of words) {
    const prev = lines.at(-1);
    if (prev !== undefined && (prev + " " + w).length <= 12) lines[lines.length - 1] = `${prev}\u00A0${w}`;
    else lines.push(w);
  }
  const slogan = brand.slogan ? upper(brand.slogan) : null;
  const unit = height / 8;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: height,
        height,
        borderRadius: height / 2,
        border: `${Math.max(3, unit * 0.35)}px solid ${secondary}`,
        backgroundColor: "#FFFFFF",
        boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
      }}
    >
      {lines.map((l, i) => (
        <div key={i} style={{ display: "flex", color: primary, fontSize: unit * 0.95, fontWeight: 800, lineHeight: 1.05, textAlign: "center" }}>
          {l}
        </div>
      ))}
      {slogan ? (
        <div
          style={{
            display: "flex",
            marginTop: unit * 0.25,
            color: secondary,
            fontSize: unit * 0.72,
            fontWeight: 800,
            fontStyle: "italic",
            lineHeight: 1,
            textAlign: "center",
            maxWidth: height * 0.72,
          }}
        >
          {slogan}
        </div>
      ) : null}
    </div>
  );
}

/** Organisation and competition logos side by side, split by a thin rule (as on the organiser's posts). */
export function Lockups({ brand, logos, height }: { brand: GraphicBrand; logos: Logos; height: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <OrgLockup brand={brand} logo={logos.org} height={height * 0.82} />
      <div style={{ display: "flex", width: 3, height: height * 0.95, backgroundColor: "#222222", margin: `0 ${height * 0.22}px` }} />
      <CompetitionLockup brand={brand} logo={logos.competition} height={height} />
    </div>
  );
}

/** Letter-spaced competition line, e.g. "QWAQWA DEVELOPMENT LEAGUE OPEN · STREAM A · TSEKI". */
export function Kicker({ brand, fontSize, width, extra, stacked }: { brand: GraphicBrand; fontSize: number; width: number; extra?: string | null; stacked?: boolean }) {
  const style: CSSProperties = { fontSize, fontWeight: 700, letterSpacing: fontSize * 0.14, color: "#1A1A1A", lineHeight: 1.2 };
  const rest = [brand.competitionSubtitle, extra].filter(Boolean).join(" · ");
  if (stacked) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Words text={brand.competitionName} style={style} width={width} charEm={0.58} />
        {rest ? <Words text={rest} style={{ ...style, color: accentOf(brand) }} width={width} charEm={0.58} /> : null}
      </div>
    );
  }
  return <Words text={[brand.competitionName, rest].filter(Boolean).join(" · ")} style={style} width={width} charEm={0.58} />;
}

/** The huge title: "LEAGUE TABLE", "FULL TIME", "FIXTURES". */
export function Title({ brand, text, fontSize }: { brand: GraphicBrand; text: string; fontSize: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        fontSize,
        fontWeight: 800,
        lineHeight: 0.92,
        color: brand.colors.primary,
        letterSpacing: fontSize * 0.01,
      }}
    >
      {upper(text)}
    </div>
  );
}

/** Slanted banner with letter-spaced text, e.g. "AS AT 15 AUGUST 2026". */
export function Banner({ brand, text, fontSize, italic }: { brand: GraphicBrand; text: string; fontSize: number; italic?: boolean }) {
  const { primary, secondary } = brand.colors;
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: `${fontSize * 0.22}px ${fontSize * 1.6}px`,
          backgroundImage: `linear-gradient(90deg, ${secondary} 0%, ${primary} 18%, ${primary} 82%, ${secondary} 100%)`,
          transform: "skewX(-14deg)",
        }}
      >
        <div
          style={{
            display: "flex",
            transform: "skewX(14deg)",
            color: "#FFFFFF",
            fontSize,
            fontWeight: 800,
            fontStyle: italic ? "italic" : "normal",
            letterSpacing: italic ? 1 : fontSize * 0.12,
            lineHeight: 1.1,
          }}
        >
          {upper(text)}
        </div>
      </div>
    </div>
  );
}

/** Dark rounded box with a number: positions, points, scores. */
export function Box({ brand, text, size, fontSize, width }: { brand: GraphicBrand; text: string; size: number; fontSize: number; width?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: width ?? size,
        height: size,
        borderRadius: size * 0.14,
        backgroundColor: brand.colors.primary,
        color: brand.colors.onPrimary,
        fontSize,
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      {text}
    </div>
  );
}

const gdText = (gd: number) => (gd > 0 ? `+${gd}` : String(gd));
const gdColour = (gd: number) => (gd > 0 ? GOOD : gd < 0 ? BAD : "#1A1A1A");

type Column = { key: string; label: string; value: (r: GraphicTableRow) => string; color?: (r: GraphicTableRow) => string };

const FULL_COLUMNS: Column[] = [
  { key: "gp", label: "GP", value: (r) => String(r.played) },
  { key: "w", label: "W", value: (r) => String(r.won) },
  { key: "d", label: "D", value: (r) => String(r.drawn) },
  { key: "l", label: "L", value: (r) => String(r.lost) },
  { key: "gf", label: "GF", value: (r) => String(r.goalsFor) },
  { key: "ga", label: "GA", value: (r) => String(r.goalsAgainst) },
  { key: "gd", label: "GD", value: (r) => gdText(r.goalDifference), color: (r) => gdColour(r.goalDifference) },
];
const COMPACT_COLUMNS: Column[] = [FULL_COLUMNS[0]!, FULL_COLUMNS[6]!];

/**
 * The league table: header bar, then rows with the position and points in dark boxes and
 * GD in green/red. Rows share the available height (`rowHeight`).
 */
export function LeagueTable({
  brand,
  rows,
  rowHeight,
  width,
  compact,
}: {
  brand: GraphicBrand;
  rows: GraphicTableRow[];
  rowHeight: number;
  width: number;
  compact?: boolean;
}) {
  const columns = compact ? COMPACT_COLUMNS : FULL_COLUMNS;
  const box = Math.round(Math.min(rowHeight * 0.84, 72));
  const boxWidth = Math.round(box * 1.25);
  const statWidth = compact ? Math.round(rowHeight * 1.05) : Math.round(Math.min(width * 0.066, rowHeight * 1.2));
  const font = Math.round(Math.min(rowHeight * 0.52, 36));
  const headerHeight = Math.round(Math.min(rowHeight * 0.8, 52));
  const headFont = Math.round(headerHeight * 0.5);
  const cell = (w: number, content: ReactNode, style: CSSProperties = {}) => (
    <div style={{ display: "flex", width: w, justifyContent: "center", alignItems: "center", ...style }}>{content}</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", width }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: headerHeight,
          borderRadius: headerHeight * 0.2,
          backgroundColor: brand.colors.primary,
          color: brand.colors.onPrimary,
          fontSize: headFont,
          fontWeight: 700,
          letterSpacing: 1,
          marginBottom: Math.round(rowHeight * 0.12),
        }}
      >
        {cell(boxWidth + 12, "POS")}
        <div style={{ display: "flex", flex: 1, paddingLeft: 16 }}>TEAM</div>
        {columns.map((c) => cell(statWidth, c.label, { flexShrink: 0 }))}
        {cell(boxWidth + 12, "PTS")}
      </div>
      {rows.map((r, i) => (
        <div key={r.name} style={{ display: "flex", alignItems: "center", height: rowHeight }}>
          {cell(boxWidth + 12, <Box brand={brand} text={r.position} size={box} width={boxWidth} fontSize={font * 1.1} />)}
          <div
            style={{
              display: "flex",
              flex: 1,
              height: "100%",
              alignItems: "center",
              paddingLeft: 16,
              borderBottom: i < rows.length - 1 ? "2px solid #D9DBD6" : "2px solid transparent",
            }}
          >
            <div
              style={{
                display: "block",
                flex: 1,
                fontSize: font,
                fontWeight: 700,
                color: "#1A1A1A",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {upper(r.name)}
            </div>
            {columns.map((c) =>
              cell(c.key === "gd" ? statWidth : statWidth, c.value(r), {
                fontSize: font,
                fontWeight: 700,
                color: c.color?.(r) ?? "#1A1A1A",
                flexShrink: 0,
              }),
            )}
          </div>
          {cell(boxWidth + 12, <Box brand={brand} text={String(r.points)} size={box} width={boxWidth} fontSize={font * 1.1} />)}
        </div>
      ))}
    </div>
  );
}

/** A white panel with a slanted title tab ("TODAY'S RESULTS", "TOP OF THE TABLE"). */
export function Panel({ brand, title, width, children, titleSize }: { brand: GraphicBrand; title: string; width: number; children: ReactNode; titleSize: number }) {
  // Satori has no z-index: later siblings paint on top, so the title tab comes after the body.
  return (
    <div style={{ display: "flex", flexDirection: "column", width, position: "relative", paddingTop: titleSize * 0.75 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width,
          padding: `${titleSize * 1.1}px ${titleSize * 0.6}px ${titleSize * 0.5}px`,
          borderRadius: 12,
          border: "2px solid #4A4A4A",
          backgroundColor: "rgba(255,255,255,0.92)",
        }}
      >
        {children}
      </div>
      <div style={{ display: "flex", position: "absolute", top: 0, left: 0, right: 0, justifyContent: "center" }}>
        <Banner brand={brand} text={title} fontSize={titleSize} italic />
      </div>
    </div>
  );
}

/** Tagline with alternating colours per sentence, like "ONE GAME. ONE PASSION. ONE LEAGUE." */
export function Tagline({ brand, fontSize }: { brand: GraphicBrand; fontSize: number }) {
  if (!brand.tagline) return null;
  const parts = upper(brand.tagline).split(/(?<=\.)\s+/);
  const accent = accentOf(brand);
  return (
    <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap" }}>
      {parts.map((p, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            fontSize,
            fontWeight: 800,
            fontStyle: "italic",
            lineHeight: 1.05,
            color: i % 2 === 1 ? accent : "#111111",
            marginRight: i < parts.length - 1 ? fontSize * 0.28 : 0,
          }}
        >
          {p}
        </div>
      ))}
    </div>
  );
}

/** Hashtags in a dark pill, separated by bars. */
export function Hashtags({ brand, fontSize }: { brand: GraphicBrand; fontSize: number }) {
  if (!brand.hashtags.length) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          padding: `${fontSize * 0.2}px ${fontSize * 1}px`,
          borderRadius: fontSize,
          backgroundColor: brand.colors.primary,
          color: brand.colors.onPrimary,
          fontSize,
          fontWeight: 700,
          letterSpacing: 0.5,
        }}
      >
        {brand.hashtags.map((tag, i) => (
          <div key={tag} style={{ display: "flex" }}>
            {i ? <div style={{ display: "flex", margin: `0 ${fontSize * 0.55}px`, opacity: 0.7 }}>|</div> : null}
            {tag}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The Facebook "f" glyph (24×24 viewBox). */
const FACEBOOK_F =
  "M15.12 5.32H17V2.14A26.11 26.11 0 0 0 14.26 2c-2.72 0-4.58 1.66-4.58 4.7v2.62H6.61v3.56h3.07V22h3.68v-9.12h3.06l.46-3.56h-3.52V7.05c0-1.03.28-1.73 1.76-1.73z";

/** Social icons, only for links the organisation or competition supplied (hidden otherwise). */
export function SocialIcons({ brand, size }: { brand: GraphicBrand; size: number }) {
  const circle = (key: string, background: string, child: ReactNode) => (
    <div
      key={key}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        margin: `0 ${size * 0.35}px`,
        borderRadius: size / 2,
        backgroundColor: background,
        color: "#FFFFFF",
        fontSize: size * 0.45,
        fontWeight: 800,
      }}
    >
      {child}
    </div>
  );
  const icons = [
    brand.social.facebook
      ? circle(
          "facebook",
          "#1877F2",
          <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24">
            <path d={FACEBOOK_F} fill="#FFFFFF" />
          </svg>,
        )
      : null,
    brand.social.instagram ? circle("instagram", "#111111", "IG") : null,
    brand.social.x ? circle("x", "#111111", "X") : null,
  ].filter((x) => x !== null);
  if (!icons.length) return null;
  return <div style={{ display: "flex", justifyContent: "center" }}>{icons}</div>;
}

/** Sponsor strip along the bottom edge: logos where supplied, otherwise names. */
export function SponsorStrip({ brand, logos, height }: { brand: GraphicBrand; logos: Logos; height: number }) {
  if (!brand.sponsors.length) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        height,
        padding: "0 24px",
        backgroundColor: "#FFFFFF",
        borderTop: `3px solid ${brand.colors.primary}`,
      }}
    >
      {brand.sponsors.map((s, i) => {
        const logo = logos.sponsors[i];
        return logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori, not the DOM
          <img key={s.name} src={logo} alt="" height={height * 0.7} style={{ height: height * 0.7, maxWidth: height * 2.4, objectFit: "contain" }} />
        ) : (
          <div
            key={s.name}
            style={{ display: "flex", fontSize: height * 0.36, fontWeight: 700, color: "#3A3A3A", letterSpacing: 1 }}
          >
            {upper(s.name)}
          </div>
        );
      })}
    </div>
  );
}
