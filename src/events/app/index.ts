import { Context, Probot, ProbotOctokit } from "probot";
import { IPullService } from "../../services/PullService";
import { sleep } from "../../utils/util";

interface RepoConfig {
  owner: string;
  repo: string;
}

// Triggered when the program starts.
export async function handleAppStartUpEvent(
  app: Probot,
  gc: InstanceType<typeof ProbotOctokit>,
  pullService: IPullService
) {
  let repoConfigs: RepoConfig[];

  if (process.env.SYNC_REPOS !== undefined) {
    repoConfigs = await getSyncRepositoryListFromEnv();
  } else {
    repoConfigs = await getSyncRepositoryListFromInstallation(app);
  }

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
  const { owner, repo } = repoConfig;
  const iterator = gc.paginate.iterator(gc.pulls.list, {
    owner: owner,
    repo: repo,
    state: "all",
    per_page: 100,
    direction: "asc",
  });

  gc.log.info(`syncing pull request from ${owner}/${repo}`);

  for await (const res of iterator) {
    for (const pull of res.data) {
      await pullService.syncPullRequest({
        owner: owner,
        repo: repo,
        pull,
      });
    }

    await sleep(1000);
  }
}

// Get all the repositories where bots are installed.
// Notice: only fetch the public repository.
async function getSyncRepositoryListFromInstallation(app: Probot) {
  const syncRepos: RepoConfig[] = [];
  const gc = await app.auth();
  const { data: installations } = await gc.apps.listInstallations();

  for (let i of installations) {
    let github = await app.auth(i.id);
    let res = await github.apps.listReposAccessibleToInstallation();
    let repositories = res.data.repositories;

    for (let repository of repositories) {
      if (!repository.private && !repository.disabled && !repository.archived) {
        syncRepos.push({
          owner: repository.owner.login,
          repo: repository.name,
        });
      }
    }
  }

  return syncRepos;
}

// Get the sync repository config from the .env file.
// The option `SYNC_REPOS` is the full name of the repository separated
// by semicolon, for example: pingcap/tidb;tikv/tikv.
async function getSyncRepositoryListFromEnv() {
  const s = process.env.SYNC_REPOS;
  const fullNames = s === undefined ? [] : s.split(";");
  const syncRepos: RepoConfig[] = [];

  for (let fullName of fullNames) {
    let arr = fullName.split("/");

    if (arr.length === 2) {
      syncRepos.push({
        owner: arr[0],
        repo: arr[1],
      });
    }
  }

  return syncRepos;
}
