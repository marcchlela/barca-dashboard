import AdminPlaceholder from "../../../components/admin/AdminPlaceholder";

export default function AdminIssuesPage() {
  return (
    <AdminPlaceholder
      eyebrow="Canonical QA"
      title="Data Issues"
      description="One place for gaps, conflicts and unresolved canonical data that need attention."
      items={[
        "Finished matches missing official highlights.",
        "Missing player or team statistics.",
        "Missing or incomplete confirmed lineups.",
        "Unresolved provider-player mappings.",
        "Missing portraits or important metadata.",
        "QA failures and manual overrides.",
      ]}
    />
  );
}