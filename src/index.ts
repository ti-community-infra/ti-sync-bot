import "reflect-metadata";

import { Context, Probot } from "probot";
import Container from "typedi";
import { createConnection, useContainer } from "typeorm";

export = (app: Probot) => {
  useContainer(Container);

  // Connect Database
  createConnection()
    .then(() => {
      // WebHook Listen
      // You can learn more about webhook through the following documents:
      // {@link https://docs.github.com/en/free-pro-team@latest/developers/webhooks-and-events}
      app.on("ping", async (context: Context) => {
        context.log.info("pong");
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
