import { Context, Probot, ProbotOctokit } from "probot";
import { EventPayloads } from "@octokit/webhooks";

import { IPullService } from "../../services/PullService";
import { ICommentService } from "../../services/CommentService";
import { IIssueService } from "../../services/IssueService";
import { IContributorService } from "../../services/ContributorService";

import { RepoKey } from "../../common/types";
import {
  fetchAllTypeComments,
  fetchIssueComments,
  fetchPullRequestCommits,
  getPullRequestPatch,
  getSyncRepositoryListFromEnv,
  getSyncRepositoryListFromInstallation,
} from "../common";

/**
 * Handle the event that triggered when the program start up.
 * @param app
 * @param github
 * @param pullService
 * @param commentService
 * @param issueService
 * @param contributorService
 */
export async function handleAppStartUpEvent(
  app: Probot,
  github: InstanceType<typeof ProbotOctokit>,
  pullService: IPullService,
  commentService: ICommentService,
  issueService: IIssueService,
  contributorService: IContributorService
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
      issueService,
      commentService
    );
  }

  // Notice: Contributor email sync must execute after the pull request sync completed.
  await handleSyncContributorEmail(github, pullService, contributorService);
}

/**
 * handle the event that triggered when the user first installs the bot to the account.
 * @param context
 * @param pullService
 * @param commentService
 * @param issueService
 * @param contributorService
 */
export async function handleAppInstallOnAccountEvent(
  context: Context<EventPayloads.WebhookPayloadInstallation>,
  pullService: IPullService,
  commentService: ICommentService,
  issueService: IIssueService,
  contributorService: IContributorService
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
      issueService,
      commentService
    );
  }

  await handleSyncContributorEmail(
    context.octokit,
    pullService,
    contributorService
  );
}

/**
 * Handle the event that triggered when the user installs the bot to another new repository
 * of the account, which has already installed the bot.
 * @param context
 * @param pullService
 * @param commentService
 * @param issueService
 * @param contributorService
 */
export async function handleAppInstallOnRepoEvent(
  context: Context<EventPayloads.WebhookPayloadInstallationRepositories>,
  pullService: IPullService,
  commentService: ICommentService,
  issueService: IIssueService,
  contributorService: IContributorService
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
      issueService,
      commentService
    );
  }

  await handleSyncContributorEmail(
    context.octokit,
    pullService,
    contributorService
  );
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
  issueService: IIssueService,
  commentService: ICommentService
) {
  const syncPullPromise = handleSyncPulls(
    repoKey,
    github,
    pullService,
    commentService
  );
  const syncIssuePromise = handleSyncIssues(
    repoKey,
    github,
    issueService,
    commentService
  );

  // Sync pull and sync issue proceed concurrently.
  await Promise.all([syncPullPromise, syncIssuePromise]);
}

/**
 * Handle pull request of a repository.
 * @param repoKey
 * @param github
 * @param pullService
 * @param commentService
 */
async function handleSyncPulls(
  repoKey: RepoKey,
  github: InstanceType<typeof ProbotOctokit>,
  pullService: IPullService,
  commentService: ICommentService
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

      // Fetch comments of pull request.
      const { reviews, reviewComments, comments } = await fetchAllTypeComments(
        github,
        pullKey
      );

      // Sync comments of pull request.
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

      // Fetch commits of pull request.
      const commits = await fetchPullRequestCommits(pullKey, github);

      // Sync status of pull request.
      // Notice: Only handle the open pull request.
      if (pull.state === "open") {
        await pullService.syncOpenPullRequestStatus({
          pull: {
            ...pullKey,
            ...pull,
          },
          comments: comments,
          reviews: reviews,
          review_comments: reviewComments,
          commits: commits,
        });
      }
    }
  }
}

/**
 * Handle issue of repository.
 * @param repoKey
 * @param github
 * @param issueService
 * @param commentService
 */
async function handleSyncIssues(
  repoKey: RepoKey,
  github: InstanceType<typeof ProbotOctokit>,
  issueService: IIssueService,
  commentService: ICommentService
) {
  const { owner, repo } = repoKey;
  const repoSignature = `${owner}/${repo}`;

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
      const issueKey = {
        ...repoKey,
        issue_number: issue.number,
      };

      // Ignore pull request.
      if (issue.pull_request) {
        continue;
      }

      // Sync issue.
      await issueService.syncIssue({
        ...repoKey,
        ...issue,
      });

      const comments = await fetchIssueComments(issueKey, github);

      // Sync issue comment.
      await commentService.syncIssueComments({
        issue: issueKey,
        comments: comments,
      });
    }
  }
}

/**
 * Synchronize contributor email according to the patch of pull request.
 * @param pullService
 * @param contributorService
 * @param github
 */
async function handleSyncContributorEmail(
  github: InstanceType<typeof ProbotOctokit>,
  pullService: IPullService,
  contributorService: IContributorService
) {
  github.log.info(`syncing contributor email`);

  const noEmailContributorLogins = await contributorService.listNoEmailContributorsLogin();

  for (const login of noEmailContributorLogins) {
    const pulls = await pullService.getContributorAllPullRequests(login);

    for (let pull of pulls) {
      const pullKey = {
        owner: pull.owner,
        repo: pull.repo,
        pull_number: pull.pullNumber,
      };

      const patch = await getPullRequestPatch(pullKey, github);

      if (patch === null) continue;

      const syncSuccess = await contributorService.syncContributorEmailFromPR({
        contributor_login: login,
        pull_request_patch: patch,
      });

      if (syncSuccess) break;
    }
  }

  github.log.info(`finish syncing contributor email`);
}
