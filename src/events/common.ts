import { Probot, ProbotOctokit } from "probot";
import { PullKey, pullKey2IssueKey, RepoKey } from "../common/types";

/**
 * Get all the repositories where bots are installed.
 * Notice: only fetch the public, not archived and not enable repository.
 * @param app
 */
export async function getSyncRepositoryListFromInstallation(
  app: Probot
): Promise<RepoKey[]> {
  const syncRepos: RepoKey[] = [];
  const github = await app.auth();
  const { data: installations } = await github.apps.listInstallations();

  for (let i of installations) {
    const github = await app.auth(i.id);
    const res = await github.apps.listReposAccessibleToInstallation();
    const repositories = res.data.repositories;

    repositories.forEach((repository) => {
      if (!repository.private && !repository.disabled && !repository.archived) {
        syncRepos.push({
          owner: repository.owner.login,
          repo: repository.name,
        });
      }
    });
  }

  return syncRepos;
}

/**
 * Get the sync repository config from the .env file.
 * The option `SYNC_REPOS` is the full name of the repository separated by comma,
 * for example: pingcap/tidb,tikv/tikv.
 */
export function getSyncRepositoryListFromEnv(): RepoKey[] {
  const s = process.env.SYNC_REPOS;
  const fullNames = s === undefined ? [] : s.trim().split(",");
  const syncRepos: RepoKey[] = [];

  fullNames.forEach((fullName) => {
    let arr = fullName.split("/");

    if (arr.length === 2) {
      syncRepos.push({
        owner: arr[0].trim(),
        repo: arr[1].trim(),
      });
    }
  });

  return syncRepos;
}

/**
 * Fetch all type comment of pull request.
 * @param github
 * @param pullKey
 */
export async function fetchAllTypeComments(
  github: InstanceType<typeof ProbotOctokit>,
  pullKey: PullKey
) {
  const issueKey = pullKey2IssueKey(pullKey);
  const reviews = await github.paginate(github.pulls.listReviews, pullKey);
  const reviewComments = await github.paginate(
    github.pulls.listReviewComments,
    pullKey
  );
  const comments = await github.paginate(github.issues.listComments, issueKey);

  return { reviews, reviewComments, comments };
}

/**
 * Obtain the patch format file of the pull request.
 * @param pullKey
 * @param github
 * @return The content of path file, return null means fail to obtain.
 */
export async function getPullRequestPatch(
  pullKey: PullKey,
  github: InstanceType<typeof ProbotOctokit>
): Promise<string | null> {
  const patchResponse = await github.pulls.get({
    ...pullKey,
    headers: {
      Accept: "application/vnd.github.VERSION.patch",
    },
  });

  if (patchResponse.status === 200) {
    // Notice: The content of the patch file type is in the form of a string.
    return (patchResponse.data as unknown) as string;
  } else {
    return null;
  }
}

/**
 * Fetch commits of pull request.
 * @param github
 * @param pullKey
 */
export async function fetchPullRequestCommits(
  pullKey: PullKey,
  github: InstanceType<typeof ProbotOctokit>
) {
  return await github.paginate(github.pulls.listCommits, pullKey);
}
