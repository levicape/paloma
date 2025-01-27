cli: pnpm run dx:cli:mjs
cli-fourtwo: pnpm exec fourtwo
cli-paloma: pnpm run dx:cli:mjs
deploy: pnpm --filter $DEPLOY_FILTER --prod --node-linker=hoisted deploy $DEPLOY_OUTPUT || true; ls -la $DEPLOY_OUTPUT || true; echo 'procfile deploy from $DEPLOY_FILTER to $DEPLOY_OUTPUT complete'; sleep 1200s
project: pnpm run -C $PROJECT_PATH
test: pnpm run test
wait: sleep 1200s
