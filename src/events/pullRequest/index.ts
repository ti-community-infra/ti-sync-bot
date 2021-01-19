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

  switch (action) {
    case "opened":
    case "edited":
    case "reopened":
    case "labeled":
    case "unlabeled":
    case "synchronize":
      // Synchronize pull request.
      await pullService.syncPullRequest({
        ...context.repo(),
        ...pullRequest,
      });
      break;
    case "closed":
      // Synchronize pull request.
      await pullService.syncPullRequest({
        ...context.repo(),
        ...pullRequest,
      });

      // Synchronize contributor mailboxes when pull request is merged.
      if (pullRequest.mergeable) {
        // Fetch the patch of pull request.
        let patch = await getPullRequestPatch(
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

      break;
    // Notice: Other events of the pull request will not change the data we need
    // to collect, but will modify the update event.
  }
}

/**
 * Handle pull request review event.
 * Refer: https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads#pull_request_review
 * @param context
 * @param commentService
 */
export async function handlePullRequestReviewEvent(
  context: Context<EventPayloads.WebhookPayloadPullRequestReview>,
  commentService: ICommentService
) {
  const { action, review } = context.payload;

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
      break;
  }
}

/**
 * Handle pull request review comment event.
 * Refer: https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads#pull_request_review_comment
 * @param context
 * @param commentService
 */
export async function handlePullRequestReviewCommentEvent(
  context: Context<EventPayloads.WebhookPayloadPullRequestReviewComment>,
  commentService: ICommentService
) {
  const { action, comment } = context.payload;

  switch (action) {
    case "created":
    case "edited":
    case "deleted":
      await commentService.syncPullRequestReviewComment({
        ...context.pullRequest(),
        ...comment,
      });
      break;
  }
}
