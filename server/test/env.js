// Tests never touch the real database: swap the database name in DATABASE_URL for "budget_test".
export const testUrl = (url) => url.replace(/\/[^/?]+(\?.*)?$/, '/budget_test$1');
export const mainUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = testUrl(mainUrl);
