AWS_DEFAULT_REGION
The AWS Region where the build is running (for example, us-east-1). This environment variable is used primarily by the AWS CLI.
AWS_REGION
The AWS Region where the build is running (for example, us-east-1). This environment variable is used primarily by the AWS SDKs.
CODEBUILD_BATCH_BUILD_IDENTIFIER
The identifier of the build in a batch build. This is specified in the batch buildspec. For more information, see Batch build buildspec reference.
CODEBUILD_BUILD_ARN
The Amazon Resource Name (ARN) of the build (for example, arn:aws:codebuild:region-ID:account-ID:build/codebuild-demo-project:b1e6661e-e4f2-4156-9ab9-82a19EXAMPLE).
CODEBUILD_BUILD_ID
The CodeBuild ID of the build (for example, codebuild-demo-project:b1e6661e-e4f2-4156-9ab9-82a19EXAMPLE).
CODEBUILD_BUILD_IMAGE
The CodeBuild build image identifier (for example, aws/codebuild/standard:2.0).
CODEBUILD_BUILD_NUMBER
The current build number for the project.
CODEBUILD_BUILD_SUCCEEDING
Whether the current build is succeeding. Set to 0 if the build is failing, or 1 if the build is succeeding.
CODEBUILD_INITIATOR
The entity that started the build. If CodePipeline started the build, this is the pipeline's name (for example, codepipeline/my-demo-pipeline). If an user started the build, this is the user's name (for example, MyUserName). If the Jenkins plugin for CodeBuild started the build, this is the string CodeBuild-Jenkins-Plugin.
CODEBUILD_KMS_KEY_ID
The identifier of the AWS KMS key that CodeBuild is using to encrypt the build output artifact (for example, arn:aws:kms:region-ID:account-ID:key/key-ID or alias/key-alias).
CODEBUILD_LOG_PATH
The log stream name in CloudWatch Logs for the build.
CODEBUILD_PUBLIC_BUILD_URL
The URL of the build results for this build on the public builds website. This variable is only set if the build project has public builds enabled. For more information, see Get public build project URLs.
CODEBUILD_RESOLVED_SOURCE_VERSION
The version identifier of a build's source code. The contents depends on the source code repository:

CodeCommit, GitHub, GitHub Enterprise Server, and Bitbucket
This variable contains the commit ID.
CodePipeline
This variable contains the source revision provided by CodePipeline.

If CodePipeline is not able to resolve the source revision, such as when the source is an Amazon S3 bucket that does not have versioning enabled, this environment variable is not set.
Amazon S3
This variable is not set.
When applicable, the CODEBUILD_RESOLVED_SOURCE_VERSION variable is only available after the DOWNLOAD_SOURCE phase.
CODEBUILD_SOURCE_REPO_URL
The URL to the input artifact or source code repository. For Amazon S3, this is s3:// followed by the bucket name and path to the input artifact. For CodeCommit and GitHub, this is the repository's clone URL. If a build originates from CodePipeline, this environment variable may be empty.

For secondary sources, the environment variable for the secondary source repository URL is CODEBUILD_SOURCE_REPO_URL_<sourceIdentifier>, where <sourceIdentifier> is the source identifier you create.
CODEBUILD_SOURCE_VERSION
The value's format depends on the source repository.

For Amazon S3, it is the version ID associated with the input artifact.
For CodeCommit, it is the commit ID or branch name associated with the version of the source code to be built.
For GitHub, GitHub Enterprise Server, and Bitbucket it is the commit ID, branch name, or tag name associated with the version of the source code to be built.
Note
For a GitHub or GitHub Enterprise Server build that is triggered by a webhook pull request event, it is pr/pull-request-number.
For secondary sources, the environment variable for the secondary source version is CODEBUILD_SOURCE_VERSION_<sourceIdentifier>, where <sourceIdentifier> is the source identifier you create. For more information, see Multiple input sources and output artifacts sample.
CODEBUILD_SRC_DIR
The directory path that CodeBuild uses for the build (for example, /tmp/src123456789/src).

For secondary sources, the environment variable for the secondary source directory path is CODEBUILD_SRC_DIR_<sourceIdentifier>, where <sourceIdentifier> is the source identifier you create. For more information, see Multiple input sources and output artifacts sample.
CODEBUILD_START_TIME
The start time of the build specified as a Unix timestamp in milliseconds.
CODEBUILD_WEBHOOK_ACTOR_ACCOUNT_ID
The account ID of the user that triggered the webhook event.
CODEBUILD_WEBHOOK_BASE_REF
The base reference name of the webhook event that triggers the current build. For a pull request, this is the branch reference.
CODEBUILD_WEBHOOK_EVENT
The webhook event that triggers the current build.
CODEBUILD_WEBHOOK_MERGE_COMMIT
The identifier of the merge commit used for the build. This variable is set when a Bitbucket pull request is merged with the squash strategy and the pull request branch is closed. In this case, the original pull request commit no longer exists, so this environment variable contains the identifier of the squashed merge commit.
CODEBUILD_WEBHOOK_PREV_COMMIT
The ID of the most recent commit before the webhook push event that triggers the current build.
CODEBUILD_WEBHOOK_HEAD_REF
The head reference name of the webhook event that triggers the current build. It can be a branch reference or a tag reference.
CODEBUILD_WEBHOOK_TRIGGER
Shows the webhook event that triggered the build. This variable is available only for builds triggered by a webhook. The value is parsed from the payload sent to CodeBuild by GitHub, GitHub Enterprise Server, or Bitbucket. The value's format depends on what type of event triggered the build.

For builds triggered by a pull request, it is pr/pull-request-number.
For builds triggered by creating a new branch or pushing a commit to a branch, it is branch/branch-name.
For builds triggered by a pushing a tag to a repository, it is tag/tag-name.
HOME
This environment variable is always set to /root.
AWS CodeBuild also supports a set of environment variables for self-hosted runner builds. To learn more about CodeBuild self-hosted runner, see Tutorial: Configure a CodeBuild-hosted GitHub Actions runner.

CODEBUILD_RUNNER_OWNER
The owner of the repository that triggers the self-hosted runner build.
CODEBUILD_RUNNER_REPO
The name of the repository that triggers the self-hosted runner build.
CODEBUILD_RUNNER_REPO_DOMAIN
The domain of the repository that triggers the self-hosted runner build. Only specified GitHub Enterprise builds.
CODEBUILD_WEBHOOK_LABEL
The label used to configure build overrides and the self-hosted runner during the build.
CODEBUILD_WEBHOOK_RUN_ID
The run ID of the workflow associated with the build.
CODEBUILD_WEBHOOK_JOB_ID
The job ID of the job associated with the build.
CODEBUILD_WEBHOOK_WORKFLOW_NAME
The name of the workflow associated with the build if it exists in the webhook request payload.
CODEBUILD_RUNNER_WITH_BUILDSPEC
If a buildspec override is configured in the self-hosted runner request labels, this is set to true.
