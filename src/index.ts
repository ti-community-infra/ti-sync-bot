import "reflect-metadata";
import { Context, Probot, ProbotOctokit } from "probot";
import Container from "typedi";
import { createConnection, useContainer } from "typeorm";

import { ILoggerToken } from "./common/token";
import { IPullServiceToken } from "./services/PullService";
import { ICommentServiceToken } from "./services/CommentService";
import { IIssueServiceToken } from "./services/IssueService";
import { IContributorServiceToken } from "./services/ContributorService";

import {
  handleAppInstallOnAccountEvent,
  handleAppInstallOnRepoEvent,
  handleAppStartUpEvent,
} from "./events/app";
import {
  handlePullRequestEvent,
  handlePullRequestReviewCommentEvent,
  handlePullRequestReviewEvent,
} from "./events/pullRequest";
import { handleIssueCommentEvent, handleIssueEvent } from "./events/issue";

export = async (app: Probot) => {
  // Init container.
  useContainer(Container);
  Container.set(ILoggerToken, app.log);

  // TODO: use the github client authed by installation id.
  // Init Github client.
  // Notice: This github client uses a TOKEN as the bot github account for access, in this case, we do not need to
  // authorize for each installation through the Github APP, but this will also bring some restrictions.
  const github = new ProbotOctokit({
    auth: {
      token: process.env.GITHUB_ACCESS_TOKEN,
    },
  });

  // Connect database.
  createConnection()
    .then(() => {
      // Handle application start up event.
      // Notice: Full sync at startup will not block the subsequent execution of
      // WebHook-based incremental sync, and the two are executed concurrently.
      handleAppStartUpEvent(
        app,
        github,
        Container.get(IPullServiceToken),
        Container.get(IIssueServiceToken),
        Container.get(ICommentServiceToken),
        Container.get(IContributorServiceToken)
      )
        .then(() => {
          app.log.info("Finish full sync successfully");
        })
        .catch((err) => {
          app.log.error(err, "Failed to finish full sync");
        });

      // Establish WebHook listen.
      // You can learn more about webhook through the following documents:
      // https://docs.github.com/en/free-pro-team@latest/developers/webhooks-and-events

      app.on("ping", async (context: Context) => {
        context.log.info("pong");
      });

      app.on("installation.created", async (context) => {
        await handleAppInstallOnAccountEvent(
          context,
          Container.get(IPullServiceToken),
          Container.get(IIssueServiceToken),
          Container.get(ICommentServiceToken),
          Container.get(IContributorServiceToken)
        );
      });

      app.on("installation_repositories.added", async (context) => {
        await handleAppInstallOnRepoEvent(
          context,
          Container.get(IPullServiceToken),
          Container.get(IIssueServiceToken),
          Container.get(ICommentServiceToken),
          Container.get(IContributorServiceToken)
        );
      });

      app.on("pull_request", async (context) => {
        await handlePullRequestEvent(
          context,
          Container.get(IPullServiceToken),
          Container.get(IContributorServiceToken)
        );
      });

      app.on("pull_request_review", async (context) => {
        await handlePullRequestReviewEvent(
          context,
          Container.get(ICommentServiceToken),
          Container.get(IPullServiceToken)
        );
      });

      app.on("pull_request_review_comment", async (context) => {
        await handlePullRequestReviewCommentEvent(
          context,
          Container.get(ICommentServiceToken),
          Container.get(IPullServiceToken)
        );
      });

      app.on("issues", async (context) => {
        await handleIssueEvent(context, Container.get(IIssueServiceToken));
      });

      app.on("issue_comment", async (context) => {
        await handleIssueCommentEvent(
          context,
          Container.get(ICommentServiceToken),
          Container.get(IPullServiceToken),
          Container.get(IIssueServiceToken)
        );
      });
    })
    .catch((err) => {
      app.log.error(err, "Failed to connect database");
    });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
