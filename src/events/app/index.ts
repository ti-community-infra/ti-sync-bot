import { Context, Logger, Probot, ProbotOctokit } from "probot";
import { EventPayloads } from "@octokit/webhooks";

import { IPullService } from "../../services/PullService";
import { ICommentService } from "../../services/CommentService";
import { IIssueService } from "../../services/IssueService";
import { IContributorService } from "../../services/ContributorService";

import { RepoKey } from "../../common/types";
import {
  fetchAllInstallations,
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
 * @param pullService
 * @param issueService
 * @param commentService
 * @param contributorService
 */
export async function handleAppStartUpEvent(
  app: Probot,
  pullService: IPullService,
  issueService: IIssueService,
  commentService: ICommentService,
  contributorService: IContributorService
) {
  let repoConfigs: RepoKey[];

  if (process.env.SYNC_REPOS !== undefined) {
    repoConfigs = await getSyncRepositoryListFromEnv();
  } else {
    repoConfigs = await getSyncRepositoryListFromInstallation(app);
  }

  await handleSyncRepos(
    repoConfigs,
    app,
    pullService,
    issueService,
    commentService,
    contributorService
  );
}

/**
 * handle the event that triggered when the user first installs the bot to the account.
 * @param context
 * @param app
 * @param pullService
 * @param issueService
 * @param commentService
 * @param contributorService
 */
export async function handleAppInstallOnAccountEvent(
  context: Context<EventPayloads.WebhookPayloadInstallation>,
  app: Probot,
  pullService: IPullService,
  issueService: IIssueService,
  commentService: ICommentService,
  contributorService: IContributorService
) {
  const { installation, repositories } = context.payload;
  const repoKeys: RepoKey[] = repositories.map(
    (repository: { name: string }) => {
      return {
        owner: installation.account.login,
        repo: repository.name,
      };
    }
  );

  await handleSyncRepos(
    repoKeys,
    app,
    pullService,
    issueService,
    commentService,
    contributorService
  );
}

/**
 * Handle the event that triggered when the user installs the bot to another new repository
 * of the account, which has already installed the bot.
 * @param context
 * @param app
 * @param pullService
 * @param issueService
 * @param commentService
 * @param contributorService
 */
export async function handleAppInstallOnRepoEvent(
  context: Context<EventPayloads.WebhookPayloadInstallationRepositories>,
  app: Probot,
  pullService: IPullService,
  issueService: IIssueService,
  commentService: ICommentService,
  contributorService: IContributorService
) {
  const { installation, repositories_added } = context.payload;
  const repoKeys: RepoKey[] = repositories_added.map(
    (repository: { name: string }) => {
      return {
        owner: installation.account.login,
        repo: repository.name,
      };
    }
  );

  await handleSyncRepos(
    repoKeys,
    app,
    pullService,
    issueService,
    commentService,
    contributorService
  );
}

/**
 * General handling for syncing repositories of all owners.
 * @param repoKeys
 * @param app
 * @param pullService
 * @param issueService
 * @param commentService
 * @param contributorService
 */
async function handleSyncRepos(
  repoKeys: RepoKey[],
  app: Probot,
  pullService: IPullService,
  issueService: IIssueService,
  commentService: ICommentService,
  contributorService: IContributorService
) {
  for (const repoKey of repoKeys) {
    const nonAuthGithub = await app.auth();
    const { data: installation } = await nonAuthGithub.apps.getRepoInstallation(
      repoKey
    );
    const github = await app.auth(installation.id);

    await handleSyncRepo(
      repoKey,
      github,
      app.log,
      pullService,
      issueService,
      commentService
    );
  }

  // Notice: Synchronizing contributor email must be performed after the synchronization PR is completed.
  await handleSyncContributorEmail(app, pullService, contributorService)
    .then(() => {
      app.log.info("Finish syncing contributor email");
    })
    .catch((err) => {
      app.log.error(err, "Failed to sync contributor email");
    });
}

/**
 * General handling for syncing a repository.
 * @param repoKey
 * @param github
 * @param log
 * @param pullService
 * @param commentService
 * @param issueService
 */
async function handleSyncRepo(
  repoKey: RepoKey,
  github: InstanceType<typeof ProbotOctokit>,
  log: Logger,
  pullService: IPullService,
  issueService: IIssueService,
  commentService: ICommentService
) {
  const { owner, repo } = repoKey;
  const repoSignature = `${owner}/${repo}`;

  log.info("Syncing repo %s", repoSignature);

  const syncPullPromise = handleSyncPulls(
    repoKey,
    github,
    log,
    pullService,
    commentService
  )
    .then(() => {
      log.info("Finish syncing pull requests of %s", repoSignature);
    })
    .catch((err) => {
      log.error(err, "Failed to sync pull requests of %s", repoSignature);
    });

  const syncIssuePromise = handleSyncIssues(
    repoKey,
    github,
    log,
    issueService,
    commentService
  )
    .then(() => {
      log.info("Finish syncing issues of %s", repoSignature);
    })
    .catch((err) => {
      log.error(err, "Failed to sync issues of %s", repoSignature);
    });

  // Sync pull and sync issue proceed concurrently.
  await Promise.all([syncPullPromise, syncIssuePromise]);
}

/**
 * Handle pull request of a repository.
 * @param repoKey
 * @param github
 * @param log
 * @param pullService
 * @param commentService
 */
async function handleSyncPulls(
  repoKey: RepoKey,
  github: InstanceType<typeof ProbotOctokit>,
  log: Logger,
  pullService: IPullService,
  commentService: ICommentService
) {
  const { owner, repo } = repoKey;
  const repoSignature = `${owner}/${repo}`;

  log.info("Syncing pull requests of %s", repoSignature);

  // Load pull requests in pagination mode.
  const pullIterator = github.paginate.iterator(github.pulls.list, {
    ...repoKey,
    state: "all",
    per_page: 100,
    direction: "asc",
  });

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
 * @param log
 * @param issueService
 * @param commentService
 */
async function handleSyncIssues(
  repoKey: RepoKey,
  github: InstanceType<typeof ProbotOctokit>,
  log: Logger,
  issueService: IIssueService,
  commentService: ICommentService
) {
  const { owner, repo } = repoKey;
  const repoSignature = `${owner}/${repo}`;

  log.info("Syncing issues from %s", repoSignature);

  // Load issues in pagination mode.
  const issueIterator = github.paginate.iterator(github.issues.listForRepo, {
    ...repoKey,
    state: "all",
    per_page: 100,
    direction: "asc",
  });

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
 * @param app
 * @param pullService
 * @param contributorService
 */
async function handleSyncContributorEmail(
  app: Probot,
  pullService: IPullService,
  contributorService: IContributorService
) {
  app.log.info("Syncing contributor email");

  // Obtain all installation IDs so that they can be obtained directly according to the owner name.
  const installationIdMap = await fetchAllInstallations(app);

  // Only contributors who have not recorded their email are traversed.
  const noEmailContributorLogins = await contributorService.listNoEmailContributorsLogin();

  for (const login of noEmailContributorLogins) {
    const pulls = await pullService.getContributorAllPullRequests(login);

    for (let pull of pulls) {
      const pullKey = {
        owner: pull.owner,
        repo: pull.repo,
        pull_number: pull.pullNumber,
      };

      // Obtain the github client authorized by the installation id associated with owner name.
      const installationId = installationIdMap.get(pull.owner);
      const github = await app.auth(installationId);

      // Obtain the email from the PR's patch format file.
      const patch = await getPullRequestPatch(pullKey, github, app.log);

      if (patch === null) continue;

      const syncSuccess = await contributorService.syncContributorEmailFromPR({
        contributor_login: login,
        pull_request_patch: patch,
      });

      if (syncSuccess) break;
    }
  }
}
