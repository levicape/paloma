#!/usr/bin/env sh

lc_install_verdaccio() {
	  echo "Installing Verdaccio..."
	helm repo add verdaccio https://verdaccio.github.io/charts
	helm repo update
	helm install verdaccio verdaccio/verdaccio --namespace $1 --create-namespace --set persistence.enabled=true --set persistence.size=20Gi --set persistence.storageClass=standard
}

ls_configure_nodeport() {
	export VERDACCIO_POD=$(kubectl get pods --namespace default -l "app.kubernetes.io/name=verdaccio,app.kubernetes.io/instance=verdaccio" -o jsonpath="{.items[0].metadata.name}")
	echo "Verdaccio: $VERDACCIO_POD";

	export VERDACCIO_PORT=$(kubectl get pod --namespace default $VERDACCIO_POD -o jsonpath="{.spec.containers[0].ports[0].containerPort}")
	echo "Visit http://127.0.0.1:31313 to use your application"

	kubectl delete service verdaccio;
	kubectl expose deployment verdaccio --type=NodePort;
	kubectl patch service verdaccio --type='json' --patch='[{"op": "replace", "path": "/spec/ports/0/nodePort", "value":31313}]';
}
