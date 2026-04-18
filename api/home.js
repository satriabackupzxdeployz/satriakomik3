const { scrapeByType } = require('./_scraper.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const trending = await scrapeByType('manga');
    const popular = await scrapeByType('manga');

    const mapData = (item) => ({
      url: item.url,
      title: item.title,
      thumbnail: item.thumbnail,
      genre: item.genre || item.type,
      type: item.type,
    });

    const trendingMapped = trending.slice(0, 10).map(mapData);
    const popularMapped = popular.slice(10, 19).map(mapData);

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    res.json({
      status: true,
      trending: trendingMapped,
      popular: popularMapped,
    });
  } catch (err) {
    console.error('Home error:', err.message);
    res.status(500).json({ error: 'Failed to fetch home data', message: err.message });
  }
};const