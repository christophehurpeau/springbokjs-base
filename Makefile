publish:
	npm publish && git tag v$$(npm info . version) && git push origin v$$(npm info . version)
