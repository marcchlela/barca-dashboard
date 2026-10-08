import MyBarcaPageClient from "../../components/my-barca/MyBarcaPageClient";
import { getMyBarca } from "../../lib/my-barca/get-my-barca";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MyBarcaPage() {
  return <MyBarcaPageClient data={await getMyBarca()} />;
}
