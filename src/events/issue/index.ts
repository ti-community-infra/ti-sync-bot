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
  const issueKey = context.issue();

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
    default:
      await issueService.syncIssueUpdateTime(issueKey, issue.updated_at);
  }
}

/**
 * Handle issue and pull request comment event.
 * Refer: https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads#issue_comment
 * @param context
 * @param commentService
 * @param pullService
 * @param issueService
 */
export async function handleIssueCommentEvent(
  context: Context<EventPayloads.WebhookPayloadIssueComment>,
  commentService: ICommentService,
  pullService: IPullService,
  issueService: IIssueService
) {
  const { action, comment, issue } = context.payload;
  const pullKey = context.pullRequest();
  const issueKey = context.issue();

  switch (action) {
    case "created":
    case "edited":
      if (pullKey && pullKey.pull_number != undefined) {
        // Handle pull request comment.
        await commentService.syncPullRequestComment({
          ...pullKey,
          ...comment,
        });
        await pullService.syncOpenPRLastCommentTime({
          pull: {
            ...pullKey,
            user: issue.user,
          },
          last_comment_author: comment.user,
          last_comment_time: comment.updated_at,
        });
        await pullService.syncPullRequestUpdateTime(pullKey, issue.updated_at);
      } else {
        // Handle issue comment.
        await commentService.syncIssueComment({
          ...issueKey,
          ...comment,
        });
        await issueService.syncIssueUpdateTime(issueKey, issue.updated_at);
      }

      break;
  }
}
