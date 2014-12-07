publish:
	npm publish

create-tag:
	git tag v$$(npm info . version) && git push origin v$$(npm info . version)
