export type MovieView = {
  id: string;
  imdbId: string;
  title: string;
  year: string;
  mediaType: "movie" | "tv";
  rating: number | null;
  posterUrl: string | null;
  overview: string;
  cast: string[];
  director: string;
  genre: string;
  streaming: string[];
  explanation?: string;
  sceneDetective?: {
    description: string;
    timestamp?: string;
    location?: string;
    characters: string[];
    visualElements: string[];
  };
  recommendations?: MovieView[];
};
