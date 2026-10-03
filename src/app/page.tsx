import DashboardClient from "../components/dashboard/DashboardClient";
import DashboardUnavailable from "../components/dashboard/DashboardUnavailable";

import {
  getDashboardOverview,
} from "../lib/dashboard/overview";

/*
|--------------------------------------------------------------------------
| Dynamic overview
|--------------------------------------------------------------------------
|
| The dashboard depends on live database data.
|
| Never prerender this page during `next build`, because the production
| Docker build intentionally does not connect to the runtime PostgreSQL
| container.
|
| Instead, load the current canonical database state on each request.
|--------------------------------------------------------------------------
*/

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

/*
|--------------------------------------------------------------------------
| Overview data loader
|--------------------------------------------------------------------------
*/

async function loadDashboardOverview() {
  try {
    return await getDashboardOverview();
  } catch (error) {
    console.error(
      "DASHBOARD OVERVIEW LOAD FAILED:",
      error,
    );

    return null;
  }
}

/*
|--------------------------------------------------------------------------
| Home / Overview
|--------------------------------------------------------------------------
*/

export default async function Home() {
  const overview =
    await loadDashboardOverview();

  if (!overview) {
    return (
      <DashboardUnavailable />
    );
  }

  return (
    <DashboardClient
      overview={overview}
    />
  );
}