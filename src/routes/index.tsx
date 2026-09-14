import { createFileRoute } from "@tanstack/react-router";
import { AdminConfigCenter } from "../admin-config-center";
import { AdminExperience } from "../admin-experience";
import { AdminRoster } from "../admin-roster";
import { GamificationApp } from "../gamification-app";
import { WheelExperience } from "../wheel-experience";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <>
      <GamificationApp />
      <WheelExperience />
      <AdminExperience />
      <AdminRoster />
      <AdminConfigCenter />
    </>
  );
}
