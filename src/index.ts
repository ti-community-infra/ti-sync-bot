import "reflect-metadata";

import { Context, Probot, ProbotOctokit } from "probot";
import Container from "typedi";
import { createConnection, useContainer } from "typeorm";
import {
  handleAppInstallOnAccountEvent,
  handleAppInstallOnRepoEvent,
  handleAppStartUpEvent,
} from "./events/app";
import { IPullServiceToken } from "./services/PullService";
import { ILoggerToken } from "./common/global";

export = async (app: Probot) => {
  // Init Container
  useContainer(Container);
  Container.set(ILoggerToken, app.log);

  // Init Github Client
  // Notice: This client uses a TOKEN as the bot github account for access, in this case, we do not need to
  // authorize for each installation through the Github APP, but this will also bring some restrictions.
  const githubClient = new ProbotOctokit({
    auth: {
      token: process.env.GITHUB_ACCESS_TOKEN,
    },
    log: app.log,
  });

  // Connect Database
  createConnection()
    .then(() => {
      // Handle application start up event.
      // Notice: Full sync at startup will not block the subsequent execution of
      // WebHook-based incremental sync, and the two are executed concurrently.
      handleAppStartUpEvent(
        app,
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
