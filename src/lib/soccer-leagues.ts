/**
 * Country + league identity for The Odds API's soccer competition keys.
 *
 * Soccer is the one sport where "the sport" isn't a league — a single SOCCER
 * feed mixes competitions from a dozen countries, so the pick forms group by
 * country then league rather than showing one flat list.
 *
 * Flags are country codes rendered as images (see SoccerLeagueMeta.code).
 *
 * Any key not in this table still works — `soccerLeagueMeta` derives a readable
 * label from the key itself and files it under "Other". That matters because
 * the league list is discovered live from the API, so a competition can appear
 * that this table has never seen.
 */

export interface SoccerLeagueMeta {
  country: string;
  /**
   * Lower-case flagcdn code (ISO 3166-1 alpha-2, plus gb-eng / gb-sct for the
   * home nations), or "" where no single flag applies.
   *
   * Images rather than emoji: Windows ships no country-flag emoji at all, so
   * regional-indicator pairs render there as two letters and the England and
   * Scotland subdivision sequences render as nothing. A flag that only appears
   * on Macs and phones isn't a flag.
   */
  code: string;
  league: string;
  /** Sort weight for the country heading; lower shows first. */
  rank: number;
  /**
   * TheSportsDB's own country name, when it differs from the one we display.
   * Used only for the league-badge lookup.
   */
  badgeCountry?: string;
}

const LEAGUES: Record<string, SoccerLeagueMeta> = {
  // England
  soccer_epl: { country: "England", code: "gb-eng", league: "Premier League", rank: 1 },
  soccer_efl_champ: { country: "England", code: "gb-eng", league: "Championship", rank: 1 },
  soccer_england_league1: { country: "England", code: "gb-eng", league: "League One", rank: 1 },
  soccer_england_league2: { country: "England", code: "gb-eng", league: "League Two", rank: 1 },
  soccer_england_efl_cup: { country: "England", code: "gb-eng", league: "EFL Cup", rank: 1 },
  soccer_fa_cup: { country: "England", code: "gb-eng", league: "FA Cup", rank: 1 },

  // Spain
  soccer_spain_la_liga: { country: "Spain", code: "es", league: "LaLiga", rank: 2 },
  soccer_spain_segunda_division: { country: "Spain", code: "es", league: "LaLiga 2", rank: 2 },

  // Italy
  soccer_italy_serie_a: { country: "Italy", code: "it", league: "Serie A", rank: 3 },
  soccer_italy_serie_b: { country: "Italy", code: "it", league: "Serie B", rank: 3 },

  // Germany
  soccer_germany_bundesliga: { country: "Germany", code: "de", league: "Bundesliga", rank: 4 },
  soccer_germany_bundesliga2: { country: "Germany", code: "de", league: "2. Bundesliga", rank: 4 },
  soccer_germany_liga3: { country: "Germany", code: "de", league: "3. Liga", rank: 4 },

  // France
  soccer_france_ligue_one: { country: "France", code: "fr", league: "Ligue 1", rank: 5 },
  soccer_france_ligue_two: { country: "France", code: "fr", league: "Ligue 2", rank: 5 },

  // Rest of Europe
  soccer_netherlands_eredivisie: { country: "Netherlands", code: "nl", league: "Eredivisie", rank: 6 },
  soccer_portugal_primeira_liga: { country: "Portugal", code: "pt", league: "Primeira Liga", rank: 6 },
  soccer_belgium_first_div: { country: "Belgium", code: "be", league: "Pro League", rank: 6 },
  soccer_turkey_super_league: { country: "Turkey", code: "tr", league: "Süper Lig", rank: 6 },
  soccer_greece_super_league: { country: "Greece", code: "gr", league: "Super League", rank: 6 },
  soccer_switzerland_superleague: { country: "Switzerland", code: "ch", league: "Super League", rank: 6 },
  soccer_austria_bundesliga: { country: "Austria", code: "at", league: "Bundesliga", rank: 6 },
  soccer_denmark_superliga: { country: "Denmark", code: "dk", league: "Superliga", rank: 6 },
  soccer_norway_eliteserien: { country: "Norway", code: "no", league: "Eliteserien", rank: 6 },
  soccer_sweden_allsvenskan: { country: "Sweden", code: "se", league: "Allsvenskan", rank: 6 },
  soccer_sweden_superettan: { country: "Sweden", code: "se", league: "Superettan", rank: 6 },
  soccer_poland_ekstraklasa: { country: "Poland", code: "pl", league: "Ekstraklasa", rank: 6 },
  soccer_spl: { country: "Scotland", code: "gb-sct", league: "Premiership", rank: 6 },
  soccer_league_of_ireland: {
    country: "Ireland",
    code: "ie",
    league: "Premier Division",
    rank: 6,
    // TheSportsDB files it under the state's formal name, so the badge lookup
    // misses on the short one we display.
    badgeCountry: "Republic of Ireland",
  },
  soccer_russia_premier_league: {
    country: "Russia",
    code: "ru",
    league: "Premier League",
    rank: 6,
  },

  // Americas
  soccer_brazil_campeonato: { country: "Brazil", code: "br", league: "Série A", rank: 7 },
  soccer_brazil_serie_b: { country: "Brazil", code: "br", league: "Série B", rank: 7 },
  soccer_mexico_ligamx: { country: "Mexico", code: "mx", league: "Liga MX", rank: 7 },
  soccer_argentina_primera_division: {
    country: "Argentina",
    code: "ar",
    league: "Primera División",
    rank: 7,
  },
  soccer_chile_campeonato: { country: "Chile", code: "cl", league: "Primera División", rank: 7 },
  soccer_usa_mls: {
    country: "USA",
    code: "us",
    league: "Major League Soccer",
    rank: 7,
    badgeCountry: "United States",
  },

  // Asia-Pacific
  soccer_japan_j_league: { country: "Japan", code: "jp", league: "J1 League", rank: 8 },
  soccer_korea_kleague1: { country: "South Korea", code: "kr", league: "K League 1", rank: 8 },
  soccer_china_superleague: { country: "China", code: "cn", league: "Super League", rank: 8 },
  soccer_australia_aleague: { country: "Australia", code: "au", league: "A-League", rank: 8 },

  // Continental and international competitions have no single country, so they
  // get their own headings and sort last.
  soccer_uefa_champs_league: { country: "Europe", code: "eu", league: "Champions League", rank: 9 },
  soccer_uefa_europa_league: { country: "Europe", code: "eu", league: "Europa League", rank: 9 },
  soccer_uefa_europa_conference_league: {
    country: "Europe",
    code: "eu",
    league: "Conference League",
    rank: 9,
  },
  soccer_uefa_champs_league_qualification: {
    country: "Europe",
    code: "eu",
    league: "Champions League Qualifying",
    rank: 9,
  },
  soccer_uefa_europa_league_qualification: {
    country: "Europe",
    code: "eu",
    league: "Europa League Qualifying",
    rank: 9,
  },
  soccer_uefa_europa_conference_league_qualification: {
    country: "Europe",
    code: "eu",
    league: "Conference League Qualifying",
    rank: 9,
  },
  soccer_uefa_nations_league: { country: "Europe", code: "eu", league: "Nations League", rank: 9 },
  soccer_uefa_european_championship: { country: "Europe", code: "eu", league: "Euros", rank: 9 },
  soccer_conmebol_copa_libertadores: {
    country: "South America",
    code: "",
    league: "Copa Libertadores",
    rank: 9,
  },
  soccer_conmebol_copa_america: { country: "South America", code: "", league: "Copa América", rank: 9 },
  soccer_africa_cup_of_nations: { country: "Africa", code: "", league: "Africa Cup of Nations", rank: 9 },
  soccer_fifa_world_cup: { country: "International", code: "", league: "World Cup", rank: 10 },
  soccer_fifa_world_cup_qualifiers_europe: {
    country: "International",
    code: "",
    league: "World Cup Qualifiers (UEFA)",
    rank: 10,
  },
  soccer_fifa_world_cup_qualifiers_conmebol: {
    country: "International",
    code: "",
    league: "World Cup Qualifiers (CONMEBOL)",
    rank: 10,
  },
};

// Within a country, leagues show in the order they're declared above — top
// division first — rather than alphabetically, which would put the Championship
// above the Premier League. Unmapped keys sort last.
const LEAGUE_ORDER = new Map(Object.keys(LEAGUES).map((key, index) => [key, index]));

// Short tokens that are acronyms rather than words, so "mls" becomes "MLS" but
// "cup" doesn't become "CUP".
const ACRONYMS = new Set(["epl", "efl", "fa", "mls", "mx", "usa", "uefa", "fifa", "afc", "kfa"]);

/** Turn "soccer_brazil_serie_b" into "Brazil Serie B" for unmapped keys. */
function labelFromKey(sportKey: string): string {
  return sportKey
    .replace(/^soccer_/, "")
    .split("_")
    .map((word) =>
      ACRONYMS.has(word) ? word.toUpperCase() : word[0]!.toUpperCase() + word.slice(1)
    )
    .join(" ");
}

/**
 * Any unlisted UEFA competition still files under Europe with a readable name.
 *
 * The qualifying rounds are separate keys from the competitions proper, and the
 * API adds and renames them between seasons — enumerating them is a losing game.
 * Without this they'd fall through to "Other", which is where the European cup
 * qualifiers went missing.
 */
function uefaFallback(sportKey: string): SoccerLeagueMeta | null {
  if (!sportKey.startsWith("soccer_uefa_")) return null;
  return {
    country: "Europe",
    code: "eu",
    league: labelFromKey(sportKey).replace(/^UEFA /, ""),
    rank: 9,
  };
}

export function soccerLeagueMeta(sportKey: string): SoccerLeagueMeta {
  return (
    LEAGUES[sportKey] ??
    uefaFallback(sportKey) ?? {
      country: "Other",
      code: "",
      league: labelFromKey(sportKey),
      // Unknown competitions sort last rather than interleaving with the
      // curated ones, where their heading would look out of place.
      rank: 99,
    }
  );
}

/** Country + league name to look a competition badge up under. */
export function soccerBadgeQuery(sportKey: string): { country: string; league: string } {
  const meta = soccerLeagueMeta(sportKey);
  return { country: meta.badgeCountry ?? meta.country, league: meta.league };
}

export interface LeagueGroup<T> {
  key: string;
  league: string;
  events: T[];
}
export interface CountryGroup<T> {
  country: string;
  code: string;
  leagues: LeagueGroup<T>[];
}

/**
 * Group events into country -> league. Countries sort by the table's rank then
 * alphabetically, leagues by the table's own order (top division first), and
 * events keep the feed's ordering (kickoff).
 */
export function groupSoccerEvents<T extends { sportKey: string }>(events: T[]): CountryGroup<T>[] {
  const byCountry = new Map<string, { code: string; rank: number; leagues: Map<string, LeagueGroup<T>> }>();

  for (const event of events) {
    const meta = soccerLeagueMeta(event.sportKey);
    const country =
      byCountry.get(meta.country) ??
      { code: meta.code, rank: meta.rank, leagues: new Map<string, LeagueGroup<T>>() };
    const league =
      country.leagues.get(event.sportKey) ??
      { key: event.sportKey, league: meta.league, events: [] as T[] };
    league.events.push(event);
    country.leagues.set(event.sportKey, league);
    byCountry.set(meta.country, country);
  }

  return [...byCountry.entries()]
    .map(([country, v]) => ({
      country,
      code: v.code,
      rank: v.rank,
      leagues: [...v.leagues.values()].sort(
        (a, b) =>
          (LEAGUE_ORDER.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
            (LEAGUE_ORDER.get(b.key) ?? Number.MAX_SAFE_INTEGER) ||
          a.league.localeCompare(b.league)
      ),
    }))
    .sort((a, b) => a.rank - b.rank || a.country.localeCompare(b.country))
    .map(({ country, code, leagues }) => ({ country, code, leagues }));
}
