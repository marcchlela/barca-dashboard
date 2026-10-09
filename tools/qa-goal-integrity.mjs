/** Read-only fingerprint of goal moments and review decisions. */
import "dotenv/config";
import { createHash } from "node:crypto";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const moments = await client.query(`SELECT id, "mediaItemId", "matchEventId", "startSecond",
    "endSecond", "verificationBasis" FROM media_moment ORDER BY id`);
  const reviews = await client.query(`SELECT id, status, "matchEventId", "startSecond",
    "sourceSecond", "reviewNote" FROM goal_timestamp_candidate ORDER BY id`);
  const fingerprint = (rows) => createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  console.log(JSON.stringify({ moments: moments.rowCount, momentFingerprint: fingerprint(moments.rows),
    reviews: reviews.rowCount, pendingReviews: reviews.rows.filter((row) => row.status === "Pending").length,
    reviewFingerprint: fingerprint(reviews.rows) }, null, 2));
} finally {
  await client.end();
}
