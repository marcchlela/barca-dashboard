import type {
  Metadata,
} from "next";

import type {
  ReactNode,
} from "react";

import AdminShell from "../../components/admin/AdminShell";

export const metadata:
  Metadata = {
  title:
    "Admin Control Room | Barça Dashboard",

  description:
    "Private Barça Dashboard data and operations control room.",
};

export default function AdminLayout({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <AdminShell>
      {children}
    </AdminShell>
  );
}