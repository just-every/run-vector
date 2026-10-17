import { Link } from "@tanstack/react-router";
import "./my-work.css";

const tabs = [
  { to: "/app/my-work", label: "Assigned" },
  { to: "/app/my-work/created", label: "Created" },
  { to: "/app/my-work/subscribed", label: "Subscribed" },
  { to: "/app/my-work/activity", label: "Activity" },
] as const;

/** WORK-004: the assigned queue and the member's three personal tabs. */
export function MyWorkTabs({ current }: { current: (typeof tabs)[number]["label"] }) {
  return (
    <nav className="my-work-tabs" aria-label="My work">
      {tabs.map((tab) => (
        <Link key={tab.to} to={tab.to} activeOptions={{ exact: true, includeSearch: false }} activeProps={{}}
          aria-current={tab.label === current ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
