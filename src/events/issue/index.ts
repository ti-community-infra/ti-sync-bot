import { Context } from "probot";
import { IIssueService } from "../../services/IssueService";
import { ICommentService } from "../../services/CommentService";
import { EventPayloads } from "@octokit/webhooks";
import { IPullService } from "../../services/PullService";

/**
 * Handle issue event.
 * Refer: https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads#issues
 * @param context
 * @param issueService
 */
export async function handleIssueEvent(
  context: Context<EventPayloads.WebhookPayloadIssues>,
  issueService: IIssueService
) {
  const { action, issue } = context.payload;

  switch (action) {
    case "opened":
    case "edited":
    case "deleted":
    case "closed":
    case "reopened":
    case "labeled":
    case "unlabeled":
      await issueService.syncIssue({
        ...context.repo(),
        ...issue,
      });
      break;
    // Notice: Other events of the issue will not change the data we need
    // to collect, but will modify the update event.
  }
}

/**
 * Handle issue and pull request comment event.
 * Refer: https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads#issue_comment
 * @param context
 * @param commentService
 * @param pullService
 */
export async function handleIssueCommentEvent(
  context: Context<EventPayloads.WebhookPayloadIssueComment>,
  commentService: ICommentService,
  pullService: IPullService
) {
  const { action, comment, issue } = context.payload;

  switch (action) {
    case "created":
    case "edited":
    case "deleted":
      const pullKey = context.pullRequest();

      // Handle pull request comment.
      if (pullKey && pullKey.pull_number != undefined) {
        await commentService.syncPullRequestComment({
          ...pullKey,
          ...comment,
        });

        await pullService.syncOpenPRLastCommentTime({
          pull: {
            ...pullKey,
            ...issue,
          },
          last_comment_author: comment.user,
          last_comment_time: comment.updated_at,
        });

        await pullService.syncPullRequestUpdateTime(pullKey, issue.updated_at);
      }

      // TODO: Incremental sync for issue comment.

      break;
  }
}
