import { createFileRoute } from "@tanstack/react-router";
import { AdminConfigCenter } from "../admin-config-center";
import { AdminExperience } from "../admin-experience";
import { AdminRoster } from "../admin-roster";
import { GamificationApp } from "../gamification-app";
import { ManagerOverview } from "../manager-overview";
import { WheelExperience } from "../wheel-experience";
import { WheelQueue } from "../wheel-queue";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <>
      <GamificationApp />
      <ManagerOverview />
      <WheelExperience />
      <WheelQueue />
      <AdminExperience />
      <AdminRoster />
      <AdminConfigCenter />
    </>
  );
}
