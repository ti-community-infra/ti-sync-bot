import { Context, ProbotOctokit } from "probot";
import { IPullService } from "../../services/PullService";
import { sleep } from "../../utils/util";

interface RepoConfig {
  owner: string;
  repo: string;
}

// Triggered when the program starts.
export async function handleAppStartUpEvent(
  gc: InstanceType<typeof ProbotOctokit>,
  pullService: IPullService
) {
  // TODO: get repositories from installed list.
  const repoConfigs: RepoConfig[] = [];

  for (let repoConfig of repoConfigs) {
    await handleSyncRepo(repoConfig, gc, pullService);
  }
}

// Triggered when the user first installs the bot to the account.
export function handleAppInstallOnAccountEvent(
  context: Context,
  pullService: IPullService
) {
  const { installation, repositories } = context.payload;
  const repoConfigs = repositories.map((repository: { name: string }) => {
    return {
      owner: installation.account.login,
      repo: repository.name,
    };
  });

  for (let repoConfig of repoConfigs) {
    handleSyncRepo(repoConfig, context.octokit, pullService).then(null);
  }
}

// Triggered when the user installs the bot in the account already installed to another new repository.
export function handleAppInstallOnRepoEvent(
  context: Context,
  pullService: IPullService
) {
  const { installation, repositories_added } = context.payload;
  const repoConfigs = repositories_added.map((repository: { name: string }) => {
    return {
      owner: installation.account.login,
      repo: repository.name,
    };
  });

  for (let repoConfig of repoConfigs) {
    handleSyncRepo(repoConfig, context.octokit, pullService).then(null);
  }
}

async function handleSyncRepo(
  repoConfig: RepoConfig,
  gc: InstanceType<typeof ProbotOctokit>,
  pullService: IPullService
) {
  const iterator = gc.paginate.iterator(gc.pulls.list, {
    owner: repoConfig.owner,
    repo: repoConfig.repo,
    state: "all",
    per_page: 100,
    direction: "asc",
  });

  for await (const res of iterator) {
    for (const pull of res.data) {
      await pullService.syncPullRequest({
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        pull,
      });
    }

    await sleep(1000);
  }
}
