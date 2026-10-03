import AdminPlaceholder from "../../../components/admin/AdminPlaceholder";

export default function AdminSyncPage() {
  return (
    <AdminPlaceholder
      eyebrow="Operations"
      title="Sync Control"
      description="Safe manual controls for jobs that normally run automatically in the background."
      items={[
        "Run incremental fixture sync.",
        "Sync or repair one selected match.",
        "Run Match Media worker.",
        "Rescan official media for one match.",
        "Run canonical QA.",
        "Show clear confirmation and result logs for every operation.",
      ]}
    />
  );
}