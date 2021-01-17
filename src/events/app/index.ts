import { Context, Probot, ProbotOctokit } from "probot";
import { EventPayloads } from "@octokit/webhooks";

import { IPullService } from "../../services/PullService";
import { ICommentService } from "../../services/CommentService";
import { IIssueService } from "../../services/IssueService";
import { sleep } from "../../utils/util";

import { PullKey, RepoKey, pullKey2IssueKey } from "../../common/types";

/**
 * Handle the event that triggered when the program start up.
 * @param app
 * @param github
 * @param pullService
 * @param commentService
 * @param issueService
 */
export async function handleAppStartUpEvent(
  app: Probot,
  github: InstanceType<typeof ProbotOctokit>,
  pullService: IPullService,
  commentService: ICommentService,
  issueService: IIssueService
) {
  let repoConfigs: RepoKey[];

  if (process.env.SYNC_REPOS !== undefined) {
    repoConfigs = await getSyncRepositoryListFromEnv();
  } else {
    repoConfigs = await getSyncRepositoryListFromInstallation(app);
  }

  for (const repoConfig of repoConfigs) {
    await handleSyncRepo(
      repoConfig,
      github,
      pullService,
      commentService,
      issueService
    );
  }
}

/**
 * handle the event that triggered when the user first installs the bot to the account.
 * @param context
 * @param pullService
 * @param commentService
 * @param issueService
 */
export async function handleAppInstallOnAccountEvent(
  context: Context<EventPayloads.WebhookPayloadInstallation>,
  pullService: IPullService,
  commentService: ICommentService,
  issueService: IIssueService
) {
  const { installation, repositories } = context.payload;
  const repoConfigs: RepoKey[] = repositories.map(
    (repository: { name: string }) => {
      return {
        owner: installation.account.login,
        repo: repository.name,
      };
    }
  );

  for (const repoConfig of repoConfigs) {
    await handleSyncRepo(
      repoConfig,
      context.octokit,
      pullService,
      commentService,
      issueService
    );
  }
}

/**
 * Handle the event that triggered when the user installs the bot to another new repository
 * of the account, which has already installed the bot.
 * @param context
 * @param pullService
 * @param commentService
 * @param issueService
 */
export async function handleAppInstallOnRepoEvent(
  context: Context<EventPayloads.WebhookPayloadInstallationRepositories>,
  pullService: IPullService,
  commentService: ICommentService,
  issueService: IIssueService
) {
  const { installation, repositories_added } = context.payload;
  const repoConfigs: RepoKey[] = repositories_added.map(
    (repository: { name: string }) => {
      return {
        owner: installation.account.login,
        repo: repository.name,
      };
    }
  );

  for (const repoConfig of repoConfigs) {
    await handleSyncRepo(
      repoConfig,
      context.octokit,
      pullService,
      commentService,
      issueService
    );
  }
}

/**
 * General handling for syncing a repository.
 * @param repoKey
 * @param github
 * @param pullService
 * @param commentService
 * @param issueService
 */
async function handleSyncRepo(
  repoKey: RepoKey,
  github: InstanceType<typeof ProbotOctokit>,
  pullService: IPullService,
  commentService: ICommentService,
  issueService: IIssueService
) {
  const { owner, repo } = repoKey;
  const repoSignature = `${owner}/${repo}`;

  // Load pull requests in pagination mode.
  const pullIterator = github.paginate.iterator(github.pulls.list, {
    ...repoKey,
    state: "all",
    per_page: 100,
    direction: "asc",
  });

  github.log.info(`syncing pull request from ${repoSignature}`);

  // Handle pull requests in pagination mode.
  for await (const res of pullIterator) {
    // Process a page of data.
    for (const pull of res.data) {
      const pullKey = {
        ...repoKey,
        pull_number: pull.number,
      };

      // Sync pull request.
      await pullService.syncPullRequest({ ...repoKey, ...pull });

      // Sync comment.
      await handleSyncPullComments(pullKey, github, commentService);

      // TODO: Sync Open PR Status.
      // TODO: Sync Contributor Email.
    }

    // TODO: Optimize the sleep time.
    // In order to avoid frequent access to the API.
    await sleep(1000);
  }

  // Load issues in pagination mode.
  const issueIterator = github.paginate.iterator(github.issues.listForRepo, {
    ...repoKey,
    state: "all",
    per_page: 100,
    direction: "asc",
  });

  github.log.info(`syncing issue from ${repoSignature}`);

  // Handle issues in pagination mode.
  for await (const res of issueIterator) {
    for (let issue of res.data) {
      // Sync issue.
      await issueService.syncIssue({
        ...repoKey,
        ...issue,
      });

      // TODO: Sync issue comment.
    }

    // In order to avoid frequent access to the API.
    await sleep(1000);
  }
}

/**
 * Handle the comments of pull request.
 * @param pullKey
 * @param github
 * @param commentService
 */
async function handleSyncPullComments(
  pullKey: PullKey,
  github: InstanceType<typeof ProbotOctokit>,
  commentService: ICommentService
) {
  const { reviews, reviewComments, comments } = await fetchAllTypeComments(
    github,
    pullKey
  );

  await commentService.syncPullRequestReviews({
    pull: pullKey,
    reviews: reviews,
  });

  await commentService.syncPullRequestReviewComments({
    pull: pullKey,
    review_comments: reviewComments,
  });

  await commentService.syncPullRequestComments({
    pull: pullKey,
    comments: comments,
  });
}

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
function getSyncRepositoryListFromEnv(): RepoKey[] {
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
async function fetchAllTypeComments(
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
