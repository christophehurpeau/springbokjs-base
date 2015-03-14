VERSION ?= debug
ENV ?= dev

install:
	npm install
	npm dedupe

update:
	npm prune
	npm install
	npm dedupe

clean:
	rm -Rf lib/* public/dist/* public/images/*

watch: clean
	node_modules/.bin/gulp pre-build --env=$(ENV)
	node_modules/.bin/gulp watch --env=$(ENV)

build:
	node_modules/.bin/gulp pre-build --version=$(VERSION) --env=$(ENV)
	node_modules/.bin/gulp build --version=$(VERSION) --env=$(ENV)

migrate:
	node --harmony lib/server/migrate.js

publish:
	npm publish

create-tag:
    git tag v$$(npm info . version) && git push origin v$$(npm info . version)
