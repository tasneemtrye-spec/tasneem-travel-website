-- Draft only: apply to a staging database first; do not run against production without approval.
-- Replace the blocked Saudi ministry news index with the crawlable official ministry homepage.
UPDATE public.travel_news_sources
SET news_url = 'https://haj.gov.sa/ar',
    last_error = NULL
WHERE source_key = 'sa_haj';

-- Use the official SPA hashtag feed for Hajj and Umrah coverage; its article URLs
-- follow /N<number> and /ar/N<number>, which the scraper recognizes.
UPDATE public.travel_news_sources
SET news_url = 'https://www.spa.gov.sa/news/hashtags/66656',
    last_error = NULL
WHERE source_key = 'sa_spa';

-- The Ministry's current official domain exposes the news index at this path.
UPDATE public.travel_news_sources
SET news_url = 'https://www.yemenawqaf.org/news/details-news',
    last_error = NULL
WHERE source_key = 'ye_awqaf';
