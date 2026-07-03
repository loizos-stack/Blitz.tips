import type { PickSport } from "@prisma/client";

// Team crest lookup via ESPN's undocumented image CDN. This is an unofficial,
// unsupported endpoint (no published API, no SLA, no license) and real team
// marks are trademarked — using them here is a deliberate, informed choice
// for this project, not a default. If this ever needs to be more defensible,
// swap it for a licensed logo provider or drop back to sport icons only
// (src/components/sport-icon.tsx already provides that fallback both here
// and via onError in TeamLogo).
//
// Coverage is best-effort: only the four leagues below have a stable
// name -> abbreviation mapping (ESPN uses numeric team IDs for NCAA and
// soccer, which isn't worth hand-maintaining a lookup table for). Team
// names are normalized (lowercased, punctuation stripped) before matching
// against The Odds API's team-name strings, which are generally full
// "City Name" strings.

const CDN_BASE = "https://a.espncdn.com/i/teamlogos";

const LEAGUE_PATH: Partial<Record<PickSport, string>> = {
  NFL: "nfl",
  NBA: "nba",
  MLB: "mlb",
  NHL: "nhl",
};

function normalize(name: string): string {
  return name.toLowerCase().replace(/[.]/g, "").replace(/\s+/g, " ").trim();
}

const NFL_TEAMS: Record<string, string> = {
  "arizona cardinals": "ari",
  "atlanta falcons": "atl",
  "baltimore ravens": "bal",
  "buffalo bills": "buf",
  "carolina panthers": "car",
  "chicago bears": "chi",
  "cincinnati bengals": "cin",
  "cleveland browns": "cle",
  "dallas cowboys": "dal",
  "denver broncos": "den",
  "detroit lions": "det",
  "green bay packers": "gb",
  "houston texans": "hou",
  "indianapolis colts": "ind",
  "jacksonville jaguars": "jax",
  "kansas city chiefs": "kc",
  "las vegas raiders": "lv",
  "los angeles chargers": "lac",
  "los angeles rams": "lar",
  "miami dolphins": "mia",
  "minnesota vikings": "min",
  "new england patriots": "ne",
  "new orleans saints": "no",
  "new york giants": "nyg",
  "new york jets": "nyj",
  "philadelphia eagles": "phi",
  "pittsburgh steelers": "pit",
  "san francisco 49ers": "sf",
  "seattle seahawks": "sea",
  "tampa bay buccaneers": "tb",
  "tennessee titans": "ten",
  "washington commanders": "wsh",
};

const NBA_TEAMS: Record<string, string> = {
  "atlanta hawks": "atl",
  "boston celtics": "bos",
  "brooklyn nets": "bkn",
  "charlotte hornets": "cha",
  "chicago bulls": "chi",
  "cleveland cavaliers": "cle",
  "dallas mavericks": "dal",
  "denver nuggets": "den",
  "detroit pistons": "det",
  "golden state warriors": "gs",
  "houston rockets": "hou",
  "indiana pacers": "ind",
  "la clippers": "lac",
  "los angeles clippers": "lac",
  "los angeles lakers": "lal",
  "memphis grizzlies": "mem",
  "miami heat": "mia",
  "milwaukee bucks": "mil",
  "minnesota timberwolves": "min",
  "new orleans pelicans": "no",
  "new york knicks": "ny",
  "oklahoma city thunder": "okc",
  "orlando magic": "orl",
  "philadelphia 76ers": "phi",
  "phoenix suns": "phx",
  "portland trail blazers": "por",
  "sacramento kings": "sac",
  "san antonio spurs": "sa",
  "toronto raptors": "tor",
  "utah jazz": "utah",
  "washington wizards": "wsh",
};

const MLB_TEAMS: Record<string, string> = {
  "arizona diamondbacks": "ari",
  "atlanta braves": "atl",
  "baltimore orioles": "bal",
  "boston red sox": "bos",
  "chicago cubs": "chc",
  "chicago white sox": "chw",
  "cincinnati reds": "cin",
  "cleveland guardians": "cle",
  "colorado rockies": "col",
  "detroit tigers": "det",
  "houston astros": "hou",
  "kansas city royals": "kc",
  "los angeles angels": "laa",
  "los angeles dodgers": "lad",
  "miami marlins": "mia",
  "milwaukee brewers": "mil",
  "minnesota twins": "min",
  "new york mets": "nym",
  "new york yankees": "nyy",
  "oakland athletics": "oak",
  "athletics": "oak",
  "philadelphia phillies": "phi",
  "pittsburgh pirates": "pit",
  "san diego padres": "sd",
  "san francisco giants": "sf",
  "seattle mariners": "sea",
  "st louis cardinals": "stl",
  "tampa bay rays": "tb",
  "texas rangers": "tex",
  "toronto blue jays": "tor",
  "washington nationals": "wsh",
};

const NHL_TEAMS: Record<string, string> = {
  "anaheim ducks": "ana",
  "arizona coyotes": "ari",
  "utah hockey club": "utah",
  "utah mammoth": "utah",
  "boston bruins": "bos",
  "buffalo sabres": "buf",
  "calgary flames": "cgy",
  "carolina hurricanes": "car",
  "chicago blackhawks": "chi",
  "colorado avalanche": "col",
  "columbus blue jackets": "cbj",
  "dallas stars": "dal",
  "detroit red wings": "det",
  "edmonton oilers": "edm",
  "florida panthers": "fla",
  "los angeles kings": "la",
  "minnesota wild": "min",
  "montreal canadiens": "mtl",
  "nashville predators": "nsh",
  "new jersey devils": "nj",
  "new york islanders": "nyi",
  "new york rangers": "nyr",
  "ottawa senators": "ott",
  "philadelphia flyers": "phi",
  "pittsburgh penguins": "pit",
  "san jose sharks": "sj",
  "seattle kraken": "sea",
  "st louis blues": "stl",
  "tampa bay lightning": "tb",
  "toronto maple leafs": "tor",
  "vancouver canucks": "van",
  "vegas golden knights": "vgk",
  "washington capitals": "wsh",
  "winnipeg jets": "wpg",
};

const LEAGUE_TEAMS: Partial<Record<PickSport, Record<string, string>>> = {
  NFL: NFL_TEAMS,
  NBA: NBA_TEAMS,
  MLB: MLB_TEAMS,
  NHL: NHL_TEAMS,
};

export function getTeamLogoUrl(sport: PickSport, teamName: string): string | null {
  const leaguePath = LEAGUE_PATH[sport];
  const teams = LEAGUE_TEAMS[sport];
  if (!leaguePath || !teams) return null;

  const abbr = teams[normalize(teamName)];
  if (!abbr) return null;

  return `${CDN_BASE}/${leaguePath}/500/${abbr}.png`;
}
