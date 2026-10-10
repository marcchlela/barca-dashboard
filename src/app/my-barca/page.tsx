import MyBarcaPageClient from "../../components/my-barca/MyBarcaPageClient";
import { getMyBarca } from "../../lib/my-barca/get-my-barca";
import { getViewer } from "../../lib/auth/session";
import PersonalGate from "../../components/auth/PersonalGate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MyBarcaPage() {
  const viewer = await getViewer();
  return viewer ? <MyBarcaPageClient data={await getMyBarca(viewer.id)} /> : <PersonalGate title="My Barça" />;
}
