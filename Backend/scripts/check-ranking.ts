import assert from "assert";
import { scoreCandidate, rankVerified } from "../src/services/ranking.service";
import { MovieView } from "../src/movies/types";

const movie = (title: string, imdbId: string, year = "2010"): MovieView => ({
  id: imdbId,
  imdbId,
  title,
  year,
  mediaType: "movie",
  rating: 8,
  posterUrl: null,
  overview: "from omdb",
  cast: [],
  director: "",
  genre: "",
  streaming: []
});

const inception = movie("Inception", "tt1375666", "2010");
const matrix = movie("The Matrix", "tt0133093", "1999");

const ranked = rankVerified([
  { candidate: { title: "The Matrix", year: "1999", mediaType: "movie", confidence: 70, explanation: "green code" }, movie: matrix },
  { candidate: { title: "Inception", year: "2010", mediaType: "movie", confidence: 91, explanation: "folding hallway" }, movie: inception }
]);

assert.strictEqual(ranked[0].movie.imdbId, "tt1375666");
assert.ok(ranked[0].confidence > ranked[1].confidence);
assert.strictEqual(scoreCandidate({ title: "Totally Different", confidence: 80, explanation: "x" }, inception) < 80, true);
assert.strictEqual(ranked.length, 2);
console.log("ranking checks passed");
