#/usr/bin/env bash

now=$(date)
mkdir -p /tmp/paloma/dev || true;
while : ; do
    out=$(LOG_LEVEL=5 node module/Canary.test.mjs >> /tmp/paloma/dev/loop.log)
    [[ $? -eq 1 ]] && break
    echo $out
    echo $now
    echo $(date)
done

