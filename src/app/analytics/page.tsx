import AnalyticsPageClient from "../../components/analytics/AnalyticsPageClient";
import { getAnalyticsOverview } from "../../lib/analytics/get-analytics-overview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  const data = await getAnalyticsOverview();
  return <AnalyticsPageClient data={data} />;
}
