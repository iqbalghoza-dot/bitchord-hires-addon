import searchHandler from './search.js';

export default async function handler(req, res) {
  return searchHandler(req, res);
}
