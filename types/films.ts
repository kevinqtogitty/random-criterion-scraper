type Genre =
  | "action-adventure"
  | "animation"
  | "avant-garde"
  | "comedy"
  | "crime"
  | "documentary"
  | "drama"
  | "fantasy"
  | "film-noir"
  | "horror"
  | "musical"
  | "romance"
  | "samurai"
  | "science-fiction"
  | "shorts"
  | "silent"
  | "thriller"
  | "war"
  | "western"
  | "all";

interface Film {
  title: string | null;
  director: string | null;
  country: string | null;
  year: number | null;
  link: string | null;
  img_url: string | null;
  genres: Genre[];
}

export type { Film, Genre };
