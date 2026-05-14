import { getMachineId } from "@/shared/utils/machine";
import HomePageClient from "./HomePageClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const machineId = await getMachineId();
  return <HomePageClient machineId={machineId} />;
}
