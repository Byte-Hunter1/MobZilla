export const FEATURED = {
  trending: [
    "tt1375666",
    "tt0816692",
    "tt0133093",
    "tt0468569",
    "tt1856101",
    "tt1160419",
    "tt15239678",
    "tt15398776",
    "tt6751668",
    "tt9362722",
    "tt1745960",
    "tt2582802"
  ],
  popular_series: [
    "tt0903747",
    "tt3032476",
    "tt4574334",
    "tt0944947",
    "tt0141842",
    "tt0306414",
    "tt2356777",
    "tt2085059",
    "tt2442560",
    "tt7366338",
    "tt10919420",
    "tt3581920"
  ],
  hidden_gems: [
    "tt10288566",
    "tt7984734",
    "tt0118694",
    "tt0353969",
    "tt0317248",
    "tt0405094",
    "tt1255953",
    "tt0166924",
    "tt5311514",
    "tt0457430",
    "tt0338013",
    "tt0469494"
  ]
};

export const ALL_FEATURED_IDS = Array.from(
  new Set([...FEATURED.trending, ...FEATURED.popular_series, ...FEATURED.hidden_gems])
);
