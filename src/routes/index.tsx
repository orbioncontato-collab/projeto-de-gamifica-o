import { createFileRoute } from "@tanstack/react-router";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: "#fcfbf8" }}
    >
      <div className="w-full bg-red-600 px-4 py-3 text-center text-lg font-bold text-white">
        TESTE MVP
      </div>

      <div className="flex flex-1 items-center justify-center">
        <img
          data-lovable-blank-page-placeholder="REMOVE_THIS"
          src="https://cdn.gpteng.co/blank-app-v1.svg"
          alt="Your app will live here!"
        />
      </div>
    </div>
  );
}
