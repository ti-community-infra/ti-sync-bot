// Notice: Use type instead of interface to fix the index signature
// missing problem (issue: microsoft/TypeScript#15300).

export type RepoKey = {
  owner: string;
  repo: string;
};

export type IssueKey = {
  owner: string;
  repo: string;
  issue_number: number;
};

export type PullKey = {
  owner: string;
  repo: string;
  pull_number: number;
};

// Convert the triples of the pull request to the issue triples.
export function pullKey2IssueKey(pullKey: PullKey): IssueKey {
  return {
    owner: pullKey.owner,
    repo: pullKey.repo,
    issue_number: pullKey.pull_number,
  };
}
