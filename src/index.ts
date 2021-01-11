import "reflect-metadata";

import { Context, Probot, ProbotOctokit } from "probot";
import Container from "typedi";
import { createConnection, useContainer } from "typeorm";
import { getChildLogger } from "./utils/util";
import {
  handleAppInstallOnAccountEvent,
  handleAppInstallOnRepoEvent,
  handleAppStartUpEvent,
} from "./events/app";
import { IPullServiceToken } from "./services/PullService";
import { ILoggerToken } from "./common/global";

export = (app: Probot) => {
  // Init Container
  useContainer(Container);
  Container.set(ILoggerToken, app.log);

  // Init Github Client
  const githubClient = new ProbotOctokit({
    auth: {
      token: process.env.GITHUB_ACCESS_TOKEN,
    },
    log: getChildLogger(app.log, "octokit", "info"),
  });

  // Connect Database
  createConnection()
    .then(() => {
      // Handle application start up event,
      handleAppStartUpEvent(
        githubClient,
        Container.get(IPullServiceToken)
      ).then(null);

      // WebHook Listen
      // You can learn more about webhook through the following documents:
      // {@link https://docs.github.com/en/free-pro-team@latest/developers/webhooks-and-events}

      app.on("ping", async (context: Context) => {
        context.log.info("pong");
      });

      app.on("installation.created", async (context: Context) => {
        handleAppInstallOnAccountEvent(
          context,
          Container.get(IPullServiceToken)
        );
      });

      app.on("installation_repositories.added", async (context: Context) => {
        handleAppInstallOnRepoEvent(context, Container.get(IPullServiceToken));
      });

      app.on("issues.opened", async (context) => {
        const issueComment = context.issue({
          body: "Thanks for opening this issue!",
        });
        await context.octokit.issues.createComment(issueComment);
      });
    })
    .catch((err) => {
      console.log(err);
      app.log.error("Failed to connect database", err);
    });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
