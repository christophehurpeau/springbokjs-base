
publish:
	npm publish
	@VERSION=`node -pe "require('./package.json').version"` && \
	git tag "v$$VERSION" -m "$$VERSION"
	git push --tags origin HEAD:master

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
