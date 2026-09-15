import { createFileRoute } from "@tanstack/react-router";
import { AdminConfigCenter } from "../admin-config-center";
import { AdminExperience } from "../admin-experience";
import { AdminRoster } from "../admin-roster";
import { GamificationApp } from "../gamification-app";
import { ManagerOverviewHider } from "../manager-overview-hider";
import { ManagerOverviewV2 } from "../manager-overview-v2";
import { ManagerShell } from "../manager-shell";
import { ThemeController } from "../theme-controller";
import { WheelExperience } from "../wheel-experience";
import { WheelQueue } from "../wheel-queue";
import { WheelQuickQueue } from "../wheel-quick-queue";
import "../wheel-attempts.css";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <>
      <GamificationApp />
      <ThemeController />
      <ManagerShell />
      <ManagerOverviewV2 />
      <ManagerOverviewHider />
      <WheelExperience />
      <WheelQuickQueue />
      <WheelQueue />
      <AdminExperience />
      <AdminRoster />
      <AdminConfigCenter />
    </>
  );
}
