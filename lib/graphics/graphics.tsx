import type { ReactNode } from "react";
import type { FixturesModel, GraphicBrand, GraphicResult, GraphicTableRow, MatchCardModel, MatchdayModel } from "./model";
import {
  Banner,
  Box,
  Frame,
  Hashtags,
  Kicker,
  LeagueTable,
  Lockups,
  Panel,
  SocialIcons,
  SponsorStrip,
  Tagline,
  Title,
  accentOf,
  upper,
  Words,
  type Logos,
} from "./parts";
import { GRAPHIC_SIZES, type GraphicSize } from "./sizes";

/**
 * The graphics, one component per kind, each laid out for portrait (1080×1350),
 * square (1080×1080) and Open Graph (1200×630). Heights are budgeted up front so any
 * number of teams or matches fits without overflowing.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Metrics = {
  pad: number;
  lockups: number;
  kicker: number;
  title: number;
  banner: number;
  tagline: number;
  hashtags: number;
  social: number;
  sponsors: number;
  gap: number;
};

const METRICS: Record<Exclude<GraphicSize, "og">, Metrics> = {
  portrait: { pad: 40, lockups: 185, kicker: 32, title: 150, banner: 36, tagline: 52, hashtags: 24, social: 40, sponsors: 72, gap: 14 },
  square: { pad: 36, lockups: 128, kicker: 26, title: 104, banner: 28, tagline: 40, hashtags: 20, social: 32, sponsors: 58, gap: 10 },
};

/** Approximate rendered heights (px) of the fixed pieces, used to budget the flexible middle. */
function fixedHeight(m: Metrics, brand: GraphicBrand, parts: { title: boolean; banner: boolean }) {
  const hasSocial = brand.social.facebook || brand.social.instagram || brand.social.x;
  return (
    m.pad * 0.7 +
    m.lockups +
    m.gap +
    m.kicker * 1.25 +
    (parts.title ? m.title * 0.95 + m.gap : 0) +
    (parts.banner ? m.banner * 1.55 + m.gap : 0) +
    (brand.tagline ? m.tagline * 1.1 + m.gap * 0.6 : 0) +
    (brand.hashtags.length ? m.hashtags * 1.6 + m.gap * 0.6 : 0) +
    (hasSocial ? m.social + m.gap * 0.6 : 0) +
    m.gap +
    (brand.sponsors.length ? m.sponsors : 0)
  );
}

/** Header (lockups, competition line, title, banner) shared by portrait and square graphics. */
function Head({ brand, logos, m, width, title, banner, kickerExtra }: { brand: GraphicBrand; logos: Logos; m: Metrics; width: number; title?: string; banner?: string | null; kickerExtra?: string | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: m.pad * 0.7 }}>
      <Lockups brand={brand} logos={logos} height={m.lockups} />
      <div style={{ display: "flex", marginTop: m.gap }}>
        <Kicker brand={brand} fontSize={m.kicker} width={width - m.pad * 2} extra={kickerExtra} />
      </div>
      {title ? (
        <div style={{ display: "flex", marginTop: m.gap * 0.6 }}>
          <Title brand={brand} text={title} fontSize={m.title} />
        </div>
      ) : null}
      {banner ? (
        <div style={{ display: "flex", marginTop: m.gap }}>
          <Banner brand={brand} text={banner} fontSize={m.banner} />
        </div>
      ) : null}
    </div>
  );
}

/** Tagline, hashtags, social icons and the sponsor strip. */
function Foot({ brand, logos, m }: { brand: GraphicBrand; logos: Logos; m: Metrics }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: m.gap }}>
        <Tagline brand={brand} fontSize={m.tagline} />
        <div style={{ display: "flex", marginTop: m.gap * 0.6 }}>
          <Hashtags brand={brand} fontSize={m.hashtags} />
        </div>
        <div style={{ display: "flex", marginTop: m.gap * 0.6 }}>
          <SocialIcons brand={brand} size={m.social} />
        </div>
      </div>
      <SponsorStrip brand={brand} logos={logos} height={m.sponsors} />
    </div>
  );
}

function ResultLine({ brand, r, font }: { brand: GraphicBrand; r: GraphicResult; font: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: font * 1.75 }}>
      <div style={{ display: "block", flex: 1, fontSize: font, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {upper(r.home)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: `0 ${font * 0.4}px` }}>
        <Box brand={brand} text={r.score} size={font * 1.5} width={font * 2.4} fontSize={font * 1.2} />
        {r.note ? <div style={{ display: "flex", fontSize: font * 0.55, fontWeight: 700, color: accentOf(brand), marginTop: -2 }}>{upper(r.note)}</div> : null}
      </div>
      <div style={{ display: "block", flex: 1, fontSize: font, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {upper(r.away)}
      </div>
    </div>
  );
}

function TopLine({ brand, r, font }: { brand: GraphicBrand; r: GraphicTableRow; font: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: font * 1.75 }}>
      <Box brand={brand} text={r.position} size={font * 1.4} fontSize={font * 1.1} />
      <div style={{ display: "block", flex: 1, marginLeft: font * 0.5, fontSize: font * 1.05, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {upper(r.name)}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <div style={{ display: "flex", fontSize: font * 1.35, fontWeight: 800, lineHeight: 1 }}>{String(r.points)}</div>
        <div style={{ display: "flex", fontSize: font * 0.65, fontWeight: 700, marginLeft: 6, marginBottom: 2 }}>PTS</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Matchday (modelled on the organiser's 15 August graphic) and league table
// ---------------------------------------------------------------------------------------

/** Table + "Today's results" + "Top of the table" (`panels`), or the table alone. */
export function MatchdayGraphic({ model, size, logos, panels = true }: { model: MatchdayModel; size: GraphicSize; logos: Logos; panels?: boolean }) {
  if (size === "og") return <TableOg model={model} logos={logos} />;
  const m = METRICS[size];
  const { width, height } = GRAPHIC_SIZES[size];
  const { brand } = model;
  const inner = width - m.pad * 2;
  const banner = model.dateLabel ? `As at ${model.dateLabel}` : "Season not started";

  const panelFont = size === "portrait" ? 25 : 21;
  const maxResults = size === "portrait" ? 4 : 3;
  const shownResults = model.results.slice(0, maxResults);
  const panelLines = Math.max(shownResults.length, model.top.length, 1);
  const panelHeight = panels ? panelLines * panelFont * 1.75 + panelFont * 1.6 + panelFont * 0.6 + m.gap * 1.5 : 0;

  const budget = height - fixedHeight(m, brand, { title: true, banner: true }) - panelHeight - m.gap;
  const n = Math.max(model.rows.length, 1);
  const headerAllowance = 60;
  const rowHeight = clamp(Math.floor((budget - headerAllowance) / n), 30, size === "portrait" ? 66 : 56);

  return (
    <Frame brand={brand}>
      <Head brand={brand} logos={logos} m={m} width={width} title="League table" banner={banner} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: `${m.gap}px ${m.pad}px 0` }}>
        <LeagueTable brand={brand} rows={model.rows} rowHeight={rowHeight} width={inner} />
        {panels ? (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: m.gap * 1.5 }}>
            <Panel brand={brand} title={model.date ? "Today's results" : "Results"} width={inner * 0.5 - 10} titleSize={panelFont}>
              {shownResults.length ? (
                shownResults.map((r, i) => <ResultLine key={i} brand={brand} r={r} font={panelFont * 0.82} />)
              ) : (
                <div style={{ display: "flex", fontSize: panelFont, height: panelFont * 1.75, alignItems: "center", justifyContent: "center", color: "#555555" }}>
                  No results yet
                </div>
              )}
              {model.results.length > shownResults.length ? (
                <div style={{ display: "flex", justifyContent: "center", fontSize: panelFont * 0.7, color: "#555555" }}>
                  {`+${model.results.length - shownResults.length} more on the website`}
                </div>
              ) : null}
            </Panel>
            <Panel brand={brand} title="Top of the table" width={inner * 0.5 - 10} titleSize={panelFont}>
              {model.top.map((r) => (
                <TopLine key={r.name} brand={brand} r={r} font={panelFont * 0.9} />
              ))}
            </Panel>
          </div>
        ) : null}
      </div>
      <Foot brand={brand} logos={logos} m={m} />
    </Frame>
  );
}

/** 1200×630 table: branding on the left, compact table (top 8) on the right. */
function TableOg({ model, logos }: { model: MatchdayModel; logos: Logos }) {
  const { brand } = model;
  const rows = model.rows.slice(0, 8);
  const rowHeight = clamp(Math.floor(470 / Math.max(rows.length, 1)), 40, 64);
  return (
    <Frame brand={brand}>
      <div style={{ display: "flex", flex: 1, padding: "34px 40px 30px" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 400, alignItems: "center", justifyContent: "center" }}>
          <Lockups brand={brand} logos={logos} height={120} />
          <div style={{ display: "flex", marginTop: 18, maxWidth: 400 }}>
            <Kicker brand={brand} fontSize={22} width={380} stacked />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 8 }}>
            <Title brand={brand} text="League" fontSize={96} />
            <Title brand={brand} text="Table" fontSize={96} />
          </div>
          <div style={{ display: "flex", marginTop: 14 }}>
            <Banner brand={brand} text={model.dateLabel ? `As at ${model.dateLabel}` : "Season not started"} fontSize={24} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 30, justifyContent: "center" }}>
          <LeagueTable brand={brand} rows={rows} rowHeight={rowHeight} width={690} compact />
          {model.rows.length > rows.length ? (
            <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 20, color: "#555555", marginTop: 6 }}>
              {`Full table of ${model.rows.length} on the website`}
            </div>
          ) : null}
        </div>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------------------
// Fixtures for a date
// ---------------------------------------------------------------------------------------

export function FixturesGraphic({ model, size, logos }: { model: FixturesModel; size: GraphicSize; logos: Logos }) {
  const { brand } = model;
  const og = size === "og";
  const m = og ? null : METRICS[size];
  const { width, height } = GRAPHIC_SIZES[size];
  const banner = model.dateLabel ?? "Fixtures to be confirmed";

  if (og || !m) {
    const list = model.fixtures.slice(0, 5);
    const rowH = clamp(Math.floor(440 / Math.max(list.length, 1)), 60, 100);
    return (
      <Frame brand={brand}>
        <div style={{ display: "flex", flex: 1, padding: "34px 40px 30px" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 380, alignItems: "center", justifyContent: "center" }}>
            <Lockups brand={brand} logos={logos} height={120} />
            <div style={{ display: "flex", marginTop: 18 }}>
              <Kicker brand={brand} fontSize={22} width={380} stacked />
            </div>
            <div style={{ display: "flex", marginTop: 8 }}>
              <Title brand={brand} text="Fixtures" fontSize={104} />
            </div>
            <div style={{ display: "flex", marginTop: 14 }}>
              <Banner brand={brand} text={banner} fontSize={24} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 30, justifyContent: "center" }}>
            <FixtureRows brand={brand} fixtures={list} rowHeight={rowH} width={710} />
          </div>
        </div>
      </Frame>
    );
  }

  const inner = width - m.pad * 2;
  const budget = height - fixedHeight(m, brand, { title: true, banner: true }) - m.gap * 2;
  const maxRows = size === "portrait" ? 8 : 6;
  const list = model.fixtures.slice(0, maxRows);
  const rowHeight = clamp(Math.floor(budget / Math.max(list.length, 1)) - 12, 64, size === "portrait" ? 150 : 120);
  return (
    <Frame brand={brand}>
      <Head brand={brand} logos={logos} m={m} width={width} title="Fixtures" banner={banner} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", padding: `${m.gap}px ${m.pad}px` }}>
        <FixtureRows brand={brand} fixtures={list} rowHeight={rowHeight} width={inner} />
        {model.fixtures.length > list.length ? (
          <div style={{ display: "flex", justifyContent: "center", fontSize: 24, color: "#555555", marginTop: 8 }}>
            {`+${model.fixtures.length - list.length} more on the website`}
          </div>
        ) : null}
      </div>
      <Foot brand={brand} logos={logos} m={m} />
    </Frame>
  );
}

function FixtureRows({ brand, fixtures, rowHeight, width }: { brand: GraphicBrand; fixtures: FixturesModel["fixtures"]; rowHeight: number; width: number }) {
  if (!fixtures.length) {
    return (
      <div style={{ display: "flex", justifyContent: "center", fontSize: 40, fontWeight: 700, color: "#555555" }}>No fixtures scheduled</div>
    );
  }
  const font = clamp(Math.round(rowHeight * 0.36), 24, 46);
  const sideWidth = Math.round(width * 0.22);
  const nameWidth = (width - 10 - font * 2.1 - sideWidth) / 2 - 20;
  const name = (text: string, align: "left" | "right"): ReactNode => (
    <Words
      text={text}
      justify={align === "right" ? "flex-end" : "flex-start"}
      width={nameWidth}
      style={{ flex: 1, fontSize: font, fontWeight: 800, lineHeight: 1, color: "#111111", padding: "0 10px" }}
    />
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", width }}>
      {fixtures.map((f, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            height: rowHeight,
            marginTop: i ? 12 : 0,
            backgroundColor: "#FFFFFF",
            borderRadius: 10,
            borderLeft: `10px solid ${brand.colors.primary}`,
            boxShadow: "0 3px 10px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}
        >
          {name(f.home, "right")}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: font * 2.1,
              height: "100%",
              backgroundColor: brand.colors.primary,
              color: brand.colors.onPrimary,
              fontSize: font * 1.1,
              fontWeight: 800,
              fontStyle: "italic",
            }}
          >
            VS
          </div>
          {name(f.away, "left")}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              width: sideWidth,
              height: "100%",
              padding: "0 14px",
              borderLeft: "2px solid #D9DBD6",
            }}
          >
            <div style={{ display: "flex", fontSize: f.time.length > 5 ? font * 0.6 : font * 0.95, fontWeight: 800, color: brand.colors.primary }}>{f.time}</div>
            {f.venue ? (
              <Words text={f.venue} width={sideWidth - 28} justify="flex-start" style={{ fontSize: font * 0.5, fontWeight: 600, color: "#333333", lineHeight: 1.1 }} />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Match: full-time result, or a preview card for other states (Open Graph)
// ---------------------------------------------------------------------------------------

const TITLES: Record<MatchCardModel["state"], string> = {
  final: "Full time",
  pending: "Result to follow",
  scheduled: "Matchday",
  postponed: "Postponed",
  cancelled: "Cancelled",
  abandoned: "Abandoned",
};

export function MatchGraphic({ model, size, logos }: { model: MatchCardModel; size: GraphicSize; logos: Logos }) {
  const { brand } = model;
  const when = [model.dateLabel, model.timeLabel].filter(Boolean).join(" · ");

  if (size === "og") {
    return (
      <Frame brand={brand}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "center", padding: "30px 40px" }}>
          <Lockups brand={brand} logos={logos} height={110} />
          <div style={{ display: "flex", marginTop: 14 }}>
            <Kicker brand={brand} fontSize={22} width={1100} extra={model.roundLabel} />
          </div>
          <div style={{ display: "flex", marginTop: 12 }}>
            <Banner brand={brand} text={TITLES[model.state]} fontSize={30} />
          </div>
          <div style={{ display: "flex", flex: 1, alignItems: "center", width: "100%" }}>
            <MatchRow brand={brand} model={model} width={1120} nameFont={58} scoreFont={model.score ? 110 : 80} />
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#333333" }}>
            {upper([...model.details, when, model.venue].filter(Boolean).join("  ·  "))}
          </div>
        </div>
      </Frame>
    );
  }

  const m = METRICS[size];
  const { width } = GRAPHIC_SIZES[size];
  const nameFont = size === "portrait" ? 88 : 68;
  const scoreFont = size === "portrait" ? 230 : 170;
  return (
    <Frame brand={brand}>
      <Head brand={brand} logos={logos} m={m} width={width} title={TITLES[model.state]} banner={model.roundLabel} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "center", justifyContent: "center", padding: `0 ${m.pad}px` }}>
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <MatchRow brand={brand} model={model} width={width - m.pad * 2} nameFont={nameFont} scoreFont={model.score ? scoreFont : scoreFont * 0.6} />
        </div>
        {model.details.length ? (
          <div style={{ display: "flex", marginTop: m.gap * 1.5, fontSize: m.kicker * 1.1, fontWeight: 800, color: accentOf(brand) }}>
            {upper(model.details.join("  ·  "))}
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: m.gap * 1.5 }}>
          {when ? <div style={{ display: "flex", fontSize: m.kicker * 1.1, fontWeight: 700 }}>{upper(when)}</div> : null}
          {model.venue ? <div style={{ display: "flex", fontSize: m.kicker, fontWeight: 600, color: "#333333" }}>{upper(model.venue)}</div> : null}
        </div>
      </div>
      <Foot brand={brand} logos={logos} m={m} />
    </Frame>
  );
}

/**
 * Home name, score box, away name. The score box is sized first; each name gets half of
 * what is left, and its font shrinks until its longest word fits.
 */
function MatchRow({ brand, model, width, nameFont, scoreFont }: { brand: GraphicBrand; model: MatchCardModel; width: number; nameFont: number; scoreFont: number }) {
  const centre = model.score ?? "VS";
  const boxWidth = centre.length * scoreFont * 0.5 + scoreFont * 0.6 + 24;
  const nameWidth = Math.max(160, (width - boxWidth) / 2 - 12);
  const fit = (text: string) => {
    const longest = Math.max(...text.split(/s+/).map((w) => w.length));
    return Math.min(nameFont, Math.floor(nameWidth / (longest * 0.46)));
  };
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      <TeamName text={model.home} width={nameWidth} font={fit(model.home)} />
      <CentreScore brand={brand} text={centre} font={scoreFont} />
      <TeamName text={model.away} width={nameWidth} font={fit(model.away)} />
    </div>
  );
}

function TeamName({ text, width, font }: { text: string; width: number; font: number }) {
  return (
    <div style={{ display: "flex", flex: 1, justifyContent: "center" }}>
      <Words text={text} width={width} style={{ fontSize: font, fontWeight: 800, lineHeight: 1, color: "#111111" }} />
    </div>
  );
}

function CentreScore({ brand, text, font }: { brand: GraphicBrand; text: string; font: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${font * 0.08}px ${font * 0.3}px`,
        margin: "0 12px",
        borderRadius: 18,
        backgroundColor: brand.colors.primary,
        color: brand.colors.onPrimary,
        fontSize: font,
        fontWeight: 800,
        lineHeight: 1,
        fontStyle: text === "VS" ? "italic" : "normal",
      }}
    >
      {text}
    </div>
  );
}
