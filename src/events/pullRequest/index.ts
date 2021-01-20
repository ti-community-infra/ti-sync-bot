import { Context } from "probot";
import { ICommentService } from "../../services/CommentService";
import { IPullService } from "../../services/PullService";
import { EventPayloads } from "@octokit/webhooks";
import { IContributorService } from "../../services/ContributorService";
import { getPullRequestPatch } from "../common";

/**
 * Handle pull request event.
 * Refer: https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads#pull_request
 * @param context
 * @param pullService
 * @param contributorService
 */
export async function handlePullRequestEvent(
  context: Context<EventPayloads.WebhookPayloadPullRequest>,
  pullService: IPullService,
  contributorService: IContributorService
) {
  const { action, pull_request: pullRequest } = context.payload;

  // Synchronize pull request.
  if (
    [
      "opened",
      "edited",
      "reopened",
      "labeled",
      "unlabeled",
      "synchronize",
    ].includes(action)
  ) {
    await pullService.syncPullRequest({
      ...context.repo(),
      ...pullRequest,
    });
  }

  // Sync the last commit time of pull request.
  if (action === "synchronize" || action === "opened") {
    await pullService.syncOpenPRLastCommitTime({
      pull: context.pullRequest(),
      last_commit_time: context.payload.pull_request.updated_at,
    });
  }

  // TODO: Avoid repeated processing contributor email when pr merged.
  // Synchronize contributor mailboxes when pull request is merged.
  if (action === "closed" && pullRequest.merged_at !== null) {
    // Fetch the patch of pull request.
    const patch = await getPullRequestPatch(
      context.pullRequest(),
      context.octokit
    );

    if (patch !== null) {
      await contributorService.syncContributorEmailFromPR({
        contributor_login: pullRequest.user.login,
        pull_request_patch: patch,
      });
    }
  }
}

/**
 * Handle pull request review event.
 * Refer: https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads#pull_request_review
 * @param context
 * @param commentService
 * @param pullService
 */
export async function handlePullRequestReviewEvent(
  context: Context<EventPayloads.WebhookPayloadPullRequestReview>,
  commentService: ICommentService,
  pullService: IPullService
) {
  const { action, review, pull_request } = context.payload;
  const pullKey = context.pullRequest();

  switch (action) {
    case "submitted":
    case "edited":
    case "dismissed":
      await commentService.syncPullRequestReview({
        ...context.pullRequest(),
        // TODO: Patch the review update time.
        // Notice: The payload of pull request review does not include update time. The update time of
        // pull request will be changed due to review operations.
        ...review,
      });

      await pullService.syncOpenPRLastReviewTime({
        pull: pullKey,
        last_review_time: review.submitted_at,
      });

      await pullService.syncPullRequestUpdateTime(
        pullKey,
        pull_request.updated_at
      );

      break;
  }
}

/**
 * Handle pull request review comment event.
 * Refer: https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads#pull_request_review_comment
 * @param context
 * @param commentService
 * @param pullService
 */
export async function handlePullRequestReviewCommentEvent(
  context: Context<EventPayloads.WebhookPayloadPullRequestReviewComment>,
  commentService: ICommentService,
  pullService: IPullService
) {
  const { action, comment, pull_request } = context.payload;
  const pullKey = context.pullRequest();

  switch (action) {
    case "created":
    case "edited":
    case "deleted":
      await commentService.syncPullRequestReviewComment({
        ...pullKey,
        ...comment,
      });

      await pullService.syncOpenPRLastCommentTime({
        pull: context.pullRequest(),
        last_comment_time: comment.updated_at,
        last_comment_author: comment.user,
      });

      await pullService.syncPullRequestUpdateTime(
        pullKey,
        pull_request.updated_at
      );

      break;
  }
}
