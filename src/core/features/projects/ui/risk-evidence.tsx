import { Link } from "@tanstack/react-router";
import { activeHealthLabel } from "./helpers";
import type { ProjectDetailData } from "./data";

export function RiskEvidence({ project }: { project: ProjectDetailData }) {
  return (
    <section className="project-risks" aria-labelledby="project-risk-heading">
      <div>
        <p className="stream-overline">Project health</p>
        <h2 id="project-risk-heading">
          Why this project is{" "}
          {activeHealthLabel(project.health)?.toLocaleLowerCase()}
        </h2>
      </div>
      <ul>
        {project.risks.map((risk) => (
          <li key={`${risk.kind}-${risk.message}`} data-risk-kind={risk.kind}>
            <p>{risk.message}</p>
            {risk.dependencyLinks?.length ? (
              risk.dependencyLinks.map((dependency) => (
                <div
                  key={`${dependency.blockedIdentifier}-${dependency.blockingIdentifier}`}
                >
                  <IssueLink identifier={dependency.blockedIdentifier} />
                  <span>is blocked by</span>
                  <IssueLink identifier={dependency.blockingIdentifier} />
                </div>
              ))
            ) : risk.issueIdentifiers?.length ? (
              <div>
                {risk.issueIdentifiers.map((identifier) => (
                  <IssueLink key={identifier} identifier={identifier} />
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function IssueLink({ identifier }: { identifier: string }) {
  return (
    <Link to="/app/issues/$identifier" params={{ identifier }}>
      {identifier}
    </Link>
  );
}
