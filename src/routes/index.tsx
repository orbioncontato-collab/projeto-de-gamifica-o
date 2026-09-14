import { createFileRoute } from "@tanstack/react-router";
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
    </>
  );
}
