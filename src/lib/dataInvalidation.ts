export type DataDomain = "profile" | "garage" | "events" | "crews";

const versions: Record<DataDomain, number> = {
  profile: 0,
  garage: 0,
  events: 0,
  crews: 0,
};

export function getDataVersion(domain: DataDomain) {
  return versions[domain];
}

export function invalidateData(...domains: DataDomain[]) {
  for (const domain of domains) versions[domain] += 1;
}
