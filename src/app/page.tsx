import DashboardClient from "../components/dashboard/DashboardClient";
import DashboardUnavailable from "../components/dashboard/DashboardUnavailable";

import {
  getDashboardOverview,
} from "../lib/dashboard/overview";

/*
|--------------------------------------------------------------------------
| Overview data loader
|--------------------------------------------------------------------------
|
| Keep the try/catch OUTSIDE of JSX rendering.
|
| React's error-boundaries lint correctly warns that constructing JSX inside
| a try/catch doesn't actually catch render errors.
|
| So this function ONLY fetches the data and returns either:
|
| DashboardOverview
|
| or
|
| null
|--------------------------------------------------------------------------
*/

async function loadDashboardOverview() {
  try {
    return await getDashboardOverview();
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | Server-side logging
    |--------------------------------------------------------------------------
    |
    | The real database/network error is logged here for development.
    |
    | We deliberately don't expose raw DB errors, stack traces, credentials,
    | etc. to the user-facing UI.
    |--------------------------------------------------------------------------
    */

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

  /*
  |--------------------------------------------------------------------------
  | Database / data provider unavailable
  |--------------------------------------------------------------------------
  */

  if (!overview) {
    return (
      <DashboardUnavailable />
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Normal dashboard
  |--------------------------------------------------------------------------
  */

  return (
    <DashboardClient
      overview={overview}
    />
  );
}