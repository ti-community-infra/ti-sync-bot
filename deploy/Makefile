SHELL := /bin/bash

bots-namespace:
	kubectl apply -f cluster/bots_namespace.yaml

app-config:
	kubectl apply -f config/app_config.yaml

database-config:
	kubectl apply -f config/database_config.yaml

deploy: bots-namespace app-config database-config
	kubectl apply -f cluster

undeploy:
	kubectl delete secret app-config
	kubectl delete secret database-config
	kubectl delete deployment ti-sync-bot
	kubectl delete service ti-sync-bot
