import PasswordRecoveryScreen from "../../../components/auth/PasswordRecoveryScreen";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <PasswordRecoveryScreen mode="reset" token={typeof token === "string" ? token : undefined} />;
}
