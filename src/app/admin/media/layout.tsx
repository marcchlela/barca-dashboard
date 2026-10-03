import type {
  ReactNode,
} from "react";

import MediaSectionNav from "../../../components/admin/MediaSectionNav";

import {
  getPendingMediaReviewCount,
} from "../../../lib/admin/media-review";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function MediaLayout({
  children,
}: {
  children:
    ReactNode;
}) {
  const pendingCount =
    await getPendingMediaReviewCount();

  return (
    <>
      <MediaSectionNav
        pendingCount={
          pendingCount
        }
      />

      {children}
    </>
  );
}