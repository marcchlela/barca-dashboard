import AdminMediaManager from "../../../components/admin/AdminMediaManager";

import {
  getAdminMediaData,
} from "../../../lib/admin/media";

import {
  kitThemes,
} from "../../../lib/themes";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

async function loadMediaData() {
  try {
    return await getAdminMediaData();
  } catch (
    error
  ) {
    console.error(
      "ADMIN MEDIA LOAD FAILED:",
      error,
    );

    return null;
  }
}

export default async function AdminMediaPage() {
  const data =
    await loadMediaData();

  if (!data) {
    return (
      <MediaUnavailable />
    );
  }

  return (
    <AdminMediaManager
      data={data}
    />
  );
}

function MediaUnavailable() {
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
        Media Data Offline
      </p>

      <h2 className="mt-2 text-lg font-medium">
        Media Manager unavailable
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
        The admin shell loaded,
        but canonical media data
        could not be read from the
        database.
      </p>
    </div>
  );
}