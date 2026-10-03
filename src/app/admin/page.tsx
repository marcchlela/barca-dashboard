import AdminOverview from "../../components/admin/AdminOverview";

import {
  getAdminOverview,
} from "../../lib/admin/overview";

import {
  kitThemes,
} from "../../lib/themes";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

/*
|--------------------------------------------------------------------------
| Admin data loader
|--------------------------------------------------------------------------
|
| Keep the try/catch outside JSX construction.
|--------------------------------------------------------------------------
*/

async function loadAdminOverview() {
  try {
    return await getAdminOverview();
  } catch (error) {
    console.error(
      "ADMIN OVERVIEW LOAD FAILED:",
      error,
    );

    return null;
  }
}

/*
|--------------------------------------------------------------------------
| Admin overview
|--------------------------------------------------------------------------
*/

export default async function AdminPage() {
  const data =
    await loadAdminOverview();

  if (!data) {
    return (
      <AdminUnavailable />
    );
  }

  return (
    <AdminOverview
      data={data}
    />
  );
}

function AdminUnavailable() {
  const theme =
    kitThemes.home;

  return (
    <div
      className="
        border
        p-6
      "
      style={{
        borderColor:
          theme.colors.danger,

        backgroundColor:
          `${theme.colors.surface}A8`,
      }}
    >
      <p
        className="
          text-[8px]
          uppercase
          tracking-[0.2em]
        "
        style={{
          color:
            theme.colors.danger,
        }}
      >
        Admin Data Offline
      </p>

      <h2 className="mt-2 text-lg font-medium">
        Control Room unavailable
      </h2>

      <p
        className="
          mt-2
          max-w-lg
          text-[10px]
          leading-5
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        The admin interface
        loaded, but its
        canonical database
        snapshot could not be
        generated.
      </p>
    </div>
  );
}