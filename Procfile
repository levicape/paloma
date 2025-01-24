cli: pnpm run dx:cli:mjs
test: pnpm run test
example-canary-harness-monitor: pnpm run -C examples handler:canary:harness:lambda
example-canary-server-monitor: pnpm run -C examples handler:canary:server:lambda
deploy-paloma-examples: pnpm --filter @levicape/paloma-examples --prod --ignore-scripts deploy /tmp/paloma-examples && sleep 1200s
deploy-paloma-ui-nevada: pnpm --filter @levicape/paloma-ui-nevada --prod --ignore-scripts deploy /tmp/paloma-ui-nevada && sleep 1200s
wait: sleep 1200s
