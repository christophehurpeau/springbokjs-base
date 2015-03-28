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

watch:
	node_modules/.bin/gulp watch --env=$(ENV)

pre-build:
	node_modules/.bin/gulp pre-build --version=$(VERSION) --env=$(ENV)

build: pre-build
	node_modules/.bin/gulp build --version=$(VERSION) --env=$(ENV)

migrate:
	node --harmony lib/migrate.js

define release
	VERSION=`node -pe "require('./package.json').version"` && \
	NEXT_VERSION=`semver -i $(1) "$$VERSION"` && \
	node -e "\
		var j = require('./package.json');\
		j.version = \"$$NEXT_VERSION\";\
		var s = JSON.stringify(j, null, 2);\
		require('fs').writeFileSync('./package.json', s);" && \
	git commit -m "v$$NEXT_VERSION" -- package.json
endef


release-patch:
	@$(call release,patch)

release-minor:
	@$(call release,minor)

release-major:
	@$(call release,major)
