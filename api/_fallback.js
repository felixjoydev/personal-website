// Curated fallback set of iconic titles, served by /api/titles when imdbapi.dev is
// unreachable AND the edge cache is cold — so the globe is never empty on a cold start.
// (Files prefixed with _ are not exposed as Vercel routes.) The raw Amazon image URLs
// are sized + CORS-proxied by /api/titles at response time, same as live results.
export const FALLBACK = [
  { id: 'tt0111161', title: 'The Shawshank Redemption', year: 1994, type: 'movie', genres: ['Drama'], rating: 9.3, votes: 3198783, image: 'https://m.media-amazon.com/images/M/MV5BMDAyY2FhYjctNDc5OS00MDNlLThiMGUtY2UxYWVkNGY2ZjljXkEyXkFqcGc@._V1_.jpg' },
  { id: 'tt0468569', title: 'The Dark Knight', year: 2008, type: 'movie', genres: ['Crime', 'Thriller'], rating: 9.1, votes: 3179618, image: 'https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_.jpg' },
  { id: 'tt0110912', title: 'Pulp Fiction', year: 1994, type: 'movie', genres: ['Crime', 'Drama'], rating: 8.8, votes: 2441725, image: 'https://m.media-amazon.com/images/M/MV5BYTViYTE3ZGQtNDBlMC00ZTAyLTkyODMtZGRiZDg0MjA2YThkXkEyXkFqcGc@._V1_.jpg' },
  { id: 'tt1375666', title: 'Inception', year: 2010, type: 'movie', genres: ['Adventure', 'Sci-Fi', 'Thriller'], rating: 8.8, votes: 2826941, image: 'https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_.jpg' },
  { id: 'tt0120737', title: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001, type: 'movie', genres: ['Adventure', 'Drama', 'Fantasy'], rating: 8.9, votes: 2212295, image: 'https://m.media-amazon.com/images/M/MV5BNzIxMDQ2YTctNDY4MC00ZTRhLTk4ODQtMTVlOWY4NTdiYmMwXkEyXkFqcGc@._V1_.jpg' },
  { id: 'tt0133093', title: 'The Matrix', year: 1999, type: 'movie', genres: ['Action', 'Sci-Fi'], rating: 8.7, votes: 2254638, image: 'https://m.media-amazon.com/images/M/MV5BN2NmN2VhMTQtMDNiOS00NDlhLTliMjgtODE2ZTY0ODQyNDRhXkEyXkFqcGc@._V1_.jpg' },
  { id: 'tt0816692', title: 'Interstellar', year: 2014, type: 'movie', genres: ['Adventure', 'Drama', 'Sci-Fi'], rating: 8.7, votes: 2546298, image: 'https://m.media-amazon.com/images/M/MV5BYzdjMDAxZGItMjI2My00ODA1LTlkNzItOWFjMDU5ZDJlYWY3XkEyXkFqcGc@._V1_.jpg' },
  { id: 'tt0245429', title: 'Spirited Away', year: 2001, type: 'movie', genres: ['Animation', 'Adventure', 'Family', 'Fantasy'], rating: 8.6, votes: 971457, image: 'https://m.media-amazon.com/images/M/MV5BNTEyNmEwOWUtYzkyOC00ZTQ4LTllZmUtMjk0Y2YwOGUzYjRiXkEyXkFqcGc@._V1_.jpg' },
  { id: 'tt0114369', title: 'Seven', year: 1995, type: 'movie', genres: ['Crime', 'Drama', 'Mystery', 'Thriller'], rating: 8.6, votes: 2029032, image: 'https://m.media-amazon.com/images/M/MV5BY2IzNzMxZjctZjUxZi00YzAxLTk3ZjMtODFjODdhMDU5NDM1XkEyXkFqcGc@._V1_.jpg' },
  { id: 'tt6751668', title: 'Parasite', year: 2019, type: 'movie', genres: ['Drama', 'Thriller'], rating: 8.5, votes: 1171631, image: 'https://m.media-amazon.com/images/M/MV5BYjk1Y2U4MjQtY2ZiNS00OWQyLWI3MmYtZWUwNmRjYWRiNWNhXkEyXkFqcGc@._V1_.jpg' },
  { id: 'tt0088763', title: 'Back to the Future', year: 1985, type: 'movie', genres: ['Adventure', 'Comedy', 'Sci-Fi'], rating: 8.5, votes: 1457516, image: 'https://m.media-amazon.com/images/M/MV5BZmM3ZjE0NzctNjBiOC00MDZmLTgzMTUtNGVlOWFlOTNiZDJiXkEyXkFqcGc@._V1_.jpg' },
  { id: 'tt2582802', title: 'Whiplash', year: 2014, type: 'movie', genres: ['Drama', 'Music'], rating: 8.5, votes: 1161298, image: 'https://m.media-amazon.com/images/M/MV5BMDFjOWFkYzktYzhhMC00NmYyLTkwY2EtYjViMDhmNzg0OGFkXkEyXkFqcGc@._V1_.jpg' },
]
