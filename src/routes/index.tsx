import { createFileRoute } from "@tanstack/react-router";
import { GamificationApp } from "../gamification-app";

export const Route = createFileRoute("/")({
  component: GamificationApp,
});
