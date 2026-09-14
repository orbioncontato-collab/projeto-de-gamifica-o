import { createFileRoute } from "@tanstack/react-router";
import { AdminExperience } from "../admin-experience";
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
    </>
  );
}
